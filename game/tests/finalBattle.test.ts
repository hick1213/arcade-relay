/**
 * finalBattle.test.ts — S-19 终战系统与重试当日の验收测试（systems 层纯逻辑）。
 *
 * - 第 20 日夜「迎战」→ nightStage='battle'（開戦前選択）へ迁移し、開戦前快照を生成。
 * - 3 回合自动战力对撞: playerPower/3 ×(1±BATTLE_VARIANCE) vs ENEMY_POWER/3 ×(1±…)
 *   （random 注入で确定性验证。先取 BATTLE_ROUNDS_TO_WIN 胜で早期决着）。
 * - 「雇镖师援助」: −BATTLE_AID_COST ／ ＋BATTLE_AID_POWER、1 回のみ、银子不足は不発。
 * - 战败 = ended(finalBattleLoss)。createBattleRetryRun で第 20 日夜開戦前快照へ復帰
 *   （银子/声望/侠点/伙计状态一致 — 援助费用支払い済みも快照値で上書き＝実質返金）。
 * - 战胜 = ended(runComplete)（结局判定の詳細は S-20）。
 *
 * 运行: cd game && npm test（vitest run）
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BATTLE_AID_COST,
  BATTLE_AID_POWER,
  BATTLE_ROUNDS,
  BATTLE_VARIANCE,
  DAY_CYCLE,
  ENEMY_POWER,
  MS_PER_SECOND,
} from '../src/config';
import { canHireAid, fight, hireAid, playerPowerOf, resolveRound } from '../src/systems/finalBattle';
import { createBattleRetryRun, createResumeRun, handleTapEvent, advanceRun } from '../src/systems/runEngine';
import { staffPowerTotal } from '../src/systems/economy';
import type { FinalBattleSnapshot } from '../src/types';
import { TAP_EVENTS, type RunState, type TapEventName, type TapHit } from '../src/types';

afterEach(() => {
  vi.restoreAllMocks();
});

const tap = (event: TapEventName, payload: Readonly<Record<string, number | string>> = {}): TapHit => ({
  zoneId: 'test',
  event,
  payload,
  x: 0,
  y: 0,
});

/** 疑似乱数列（fight は 1 回合に 2 回: player → enemy の順で引く） */
const mockRandomSequence = (values: readonly number[]): void => {
  const queue = [...values];
  vi.spyOn(Math, 'random').mockImplementation(() => {
    const value = queue.shift();
    if (value === undefined) {
      throw new Error('random sequence exhausted');
    }
    return value;
  });
};

/**
 * 第 20 日夜の結果反馈段（「迎战」押下直前）まで進めた run。
 * 银子は夜工钱（−30）と事件卡 Δ（−25～+15）を吸收できる額で初期化。
 */
function makeFinalBattleEve(silver = 250): RunState {
  let run = createResumeRun({
    day: DAY_CYCLE.FINAL_BATTLE_DAY,
    silver,
    reputation: 15,
    ambition: 'wealth',
  });
  run = handleTapEvent(run, tap(TAP_EVENTS.OPEN_DOOR));
  // 日间唯一硬计时（DAY_SERVICE_DURATION_S）を 1 秒刻みの delta 快进で夜间へ（S-03 acceptance 同型）
  const hardLimitMs = DAY_CYCLE.DAY_SERVICE_DURATION_S * MS_PER_SECOND + MS_PER_SECOND;
  for (let elapsed = 0; run.phase === 'day' && elapsed <= hardLimitMs; elapsed += MS_PER_SECOND) {
    run = advanceRun(run, MS_PER_SECOND);
  }
  run = handleTapEvent(run, tap(TAP_EVENTS.EVENT_CARD_DRAW));
  run = handleTapEvent(run, tap(TAP_EVENTS.EVENT_CARD_OPTION, { optionIndex: 0 }));
  expect(run.phase).toBe('night');
  expect(run.nightStage).toBe('result');
  expect(run.finalBattleNight).toBe(true);
  return run;
}

/** 「迎战」押下直後（開戦前選択）の run */
function makeBattlePrelude(silver = 250): RunState {
  return handleTapEvent(makeFinalBattleEve(silver), tap(TAP_EVENTS.DAYBREAK));
}

/** 战败确定性（player 最小 / enemy 最大の roll を 2 回連続） */
const LOSING_RANDOMS = [0, 1, 0, 1];
/** 战胜确定性（player 最大 / enemy 最小の roll を 2 回連続 — 早期决着で 2 回合） */
const WINNING_RANDOMS = [1, 0, 1, 0];

describe('S-19 终战: 「迎战」→ 開戦前選択（快照生成）', () => {
  it('第 20 日夜の結果反馈で「迎战」→ nightStage=battle に迁移し终战状態が立つ', () => {
    const run = makeBattlePrelude();
    expect(run.nightStage).toBe('battle');
    expect(run.finalBattle).not.toBeNull();
    expect(run.finalBattle?.status).toBe('prelude');
    expect(run.finalBattle?.aidHired).toBe(false);
  });

  it('開戦前快照に银子/声望/侠点/伙计状态/志向が記録される（gdd「重新开始」）', () => {
    const run = makeBattlePrelude();
    const snapshot = run.finalBattle?.preSnapshot;
    expect(snapshot).toEqual({
      ambition: run.ambition,
      silver: run.silver,
      reputation: run.reputation,
      xiaPoints: run.xiaPoints,
      staff: run.staff,
    });
  });

  it('「迎战」の再押下は無視される（べき等ガード — 快照の二重生成なし）', () => {
    const run = handleTapEvent(makeBattlePrelude(), tap(TAP_EVENTS.DAYBREAK));
    expect(run.finalBattle?.status).toBe('prelude');
  });
});

describe('S-19 终战: 单回合算式（gdd「胜负条件」）', () => {
  it('roll = power/3 ×(1±BATTLE_VARIANCE)。端点は random 0/1 に対応', () => {
    const min = resolveRound(1, ENEMY_POWER, ENEMY_POWER, () => 0);
    expect(min.playerRoll).toBeCloseTo((ENEMY_POWER / BATTLE_ROUNDS) * (1 - BATTLE_VARIANCE), 10);
    const max = resolveRound(2, ENEMY_POWER, ENEMY_POWER, () => 1);
    expect(max.playerRoll).toBeCloseTo((ENEMY_POWER / BATTLE_ROUNDS) * (1 + BATTLE_VARIANCE), 10);
  });

  it('gdd 三档算式: playerPower 49（半数修练）は最坏回合 13.9 > 敌方最好 12.3 = 全 random で必胜', () => {
    const power = 49;
    for (const value of [0, 0.25, 0.5, 0.75, 1]) {
      const round = resolveRound(1, power, ENEMY_POWER, () => value);
      expect(round.outcome).toBe('playerWin');
    }
  });
});

describe('S-19 终战: 3 回合对撞（先取 2 胜）', () => {
  it('2 连胜で早期决着（rounds = 2、status won、ended = runComplete）', () => {
    const run = makeBattlePrelude();
    mockRandomSequence(WINNING_RANDOMS);
    const fought = fight(run);
    expect(fought.finalBattle?.rounds).toHaveLength(2);
    expect(fought.finalBattle?.status).toBe('won');
    expect(fought.ended?.kind).toBe('runComplete');
  });

  it('2 连败で status lost、ended = finalBattleLoss', () => {
    const run = makeBattlePrelude();
    mockRandomSequence(LOSING_RANDOMS);
    const fought = fight(run);
    expect(fought.finalBattle?.rounds).toHaveLength(2);
    expect(fought.finalBattle?.status).toBe('lost');
    expect(fought.ended?.kind).toBe('finalBattleLoss');
  });

  it('1-1 から第 3 回合で决着（rounds = BATTLE_ROUNDS）', () => {
    const run = makeBattlePrelude();
    mockRandomSequence([...WINNING_RANDOMS.slice(0, 2), ...LOSING_RANDOMS.slice(0, 2), 1, 0]);
    const fought = fight(run);
    expect(fought.finalBattle?.rounds).toHaveLength(BATTLE_ROUNDS);
    expect(fought.finalBattle?.status).toBe('won');
  });

  it('prelude 以外の再開战は不発（べき等）', () => {
    const run = makeBattlePrelude();
    mockRandomSequence(WINNING_RANDOMS);
    const fought = fight(run);
    expect(fight(fought)).toBe(fought);
  });
});

describe('S-19 终战: 「雇镖师援助」（−BATTLE_AID_COST ／ ＋BATTLE_AID_POWER）', () => {
  it('雇入で银子 −100、战力 +8（staffPowerTotal に対する加算）', () => {
    const run = makeBattlePrelude();
    const silverBefore = run.silver;
    expect(canHireAid(run)).toBe(true);
    const hired = hireAid(run);
    expect(hired.silver).toBe(silverBefore - BATTLE_AID_COST);
    expect(hired.finalBattle?.aidHired).toBe(true);
    expect(playerPowerOf(hired)).toBe(staffPowerTotal(hired) + BATTLE_AID_POWER);
  });

  it('2 回目の雇入は不発（银子はこれ以上減らない）', () => {
    const hired = hireAid(makeBattlePrelude());
    const again = hireAid(hired);
    expect(again).toBe(hired);
    expect(canHireAid(again)).toBe(false);
  });

  it('银子不足（silver < BATTLE_AID_COST）では不可かつ不発（acceptance「银子不足时禁用」）', () => {
    // 夜工钱 −30 后に银 70（< 100）となる初期值
    const poor = makeBattlePrelude(100);
    expect(poor.silver).toBeLessThan(BATTLE_AID_COST);
    expect(canHireAid(poor)).toBe(false);
    expect(hireAid(poor)).toBe(poor);
  });

  it('雇入してから开战 → 战力は +8 込みで対撞する（round roll の源が加算後の战力）', () => {
    const run = hireAid(makeBattlePrelude());
    mockRandomSequence(WINNING_RANDOMS);
    const fought = fight(run);
    // player max roll = (staffPowerTotal + 8)/3 ×(1.15) を下回らない（胜ち筋の确认）
    const expected = ((staffPowerTotal(run) + BATTLE_AID_POWER) / BATTLE_ROUNDS) * (1 + BATTLE_VARIANCE);
    expect(fought.finalBattle?.rounds[0]?.playerRoll).toBeCloseTo(expected, 10);
  });
});

describe('S-19 重试当日（開戦前快照の復帰）', () => {
  it('战败後 createBattleRetryRun で第 20 日夜開戦前へ復帰（数值/伙计状态一致）', () => {
    const prelude = makeBattlePrelude();
    mockRandomSequence(LOSING_RANDOMS);
    const fought = fight(prelude);
    expect(fought.ended?.kind).toBe('finalBattleLoss');

    const retried = createBattleRetryRun(fought.finalBattle?.preSnapshot as FinalBattleSnapshot);
    expect(retried.day).toBe(DAY_CYCLE.FINAL_BATTLE_DAY);
    expect(retried.phase).toBe('night');
    expect(retried.nightStage).toBe('battle');
    expect(retried.silver).toBe(prelude.silver);
    expect(retried.reputation).toBe(prelude.reputation);
    expect(retried.xiaPoints).toBe(prelude.xiaPoints);
    expect(retried.ambition).toBe(prelude.ambition);
    expect(retried.staff).toEqual(prelude.staff);
    expect(retried.finalBattle?.status).toBe('prelude');
    expect(retried.ended).toBeNull();
  });

  it('援助费用支払い済みで战败しても、快照復帰で银子は支払い前に戻る（実質返金）', () => {
    const prelude = makeBattlePrelude();
    const silverBeforeAid = prelude.silver;
    const hired = hireAid(prelude);
    expect(hired.silver).toBe(silverBeforeAid - BATTLE_AID_COST);
    mockRandomSequence(LOSING_RANDOMS);
    const fought = fight(hired);
    const retried = createBattleRetryRun(fought.finalBattle?.preSnapshot as FinalBattleSnapshot);
    expect(retried.silver).toBe(silverBeforeAid);
    expect(retried.finalBattle?.aidHired).toBe(false);
  });

  it('快照の伙计状态（岗位・疲劳込み）が復帰側で保持される', () => {
    const prelude = makeBattlePrelude();
    mockRandomSequence(LOSING_RANDOMS);
    const fought = fight(prelude);
    const snapshot = fought.finalBattle?.preSnapshot;
    const retried = createBattleRetryRun(snapshot as never);
    expect(retried.staff.map((member) => [member.id, member.post, member.fatigue])).toEqual(
      prelude.staff.map((member) => [member.id, member.post, member.fatigue]),
    );
  });
});
