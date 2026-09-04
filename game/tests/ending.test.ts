/**
 * ending.test.ts — S-20 结局判定系统の验收测试（systems 层纯逻辑）。
 *
 * - 三线达成度: 财/名 = min(值/目标, ENDING.CAP)（**封顶は财/名のみ**）、侠 = xiaPoints/32（不封顶）
 * - argmax 取结局 + 决胜规则: 复数线同为封顶值 → 开局志向线优先（P-03）/ 非封顶同值 → gdd 顺序
 * - 险成: 无一线 >= ENDING.ACHIEVED_THRESHOLD 时仍取最高线并 closeCall=true
 * - 总评分は**未封顶原值**（buildRunEndSummary は silver/reputation 原值を保持 — CAP は判定にのみ作用）
 * - buildRunEndSummary 接线: runComplete は ending/endingBonus/closeCall を填め、败局は填めない
 *
 * 运行: cd game && npm test（vitest run）
 */
import { describe, expect, it } from 'vitest';
import { ENDING, META_SAVE, SCORE } from '../src/config';
import { computeAchievements, judgeEnding } from '../src/systems/ending';
import { buildRunEndSummary } from '../src/systems/economy';
import { enterBattle } from '../src/systems/finalBattle';
import { applyRunResult, computeRunScore, createRunResult } from '../src/systems/meta/metaProgression';
import { createDefaultSaveData } from '../src/systems/meta/metaSchema';
import { createResumeRun } from '../src/systems/runEngine';
import type { AmbitionId, RunEndSummary, RunState } from '../src/types';

/**
 * 指定三线值＋志向の run（staff は createResumeRun 既定 — staffPower は判定に関与しない）。
 * battleWon: 结局判定の前提 = 终战胜利（gdd「胜负条件」— buildRunEndSummary のゲート）。
 * 终战胜利相当の run は enterBattle 後の finalBattle.status を 'won' に置く模拟で作る
 * （fight は乱数のため determinism 保証の経路を直接組まない）。
 */
function makeRun(
  values: {
    silver: number;
    reputation: number;
    xiaPoints: number;
    ambition: AmbitionId;
  },
  options: { readonly battleWon?: boolean } = {},
): RunState {
  const base = createResumeRun({
    ambition: values.ambition,
    silver: values.silver,
    reputation: values.reputation,
    day: 20,
  });
  const run = { ...base, xiaPoints: values.xiaPoints };
  if (options.battleWon !== true) {
    return run;
  }
  const battling = enterBattle(run);
  const battle = battling.finalBattle;
  if (battle === null) {
    throw new Error('到達不能: enterBattle 後の finalBattle は非 null');
  }
  return { ...battling, finalBattle: { ...battle, status: 'won' } };
}

describe('computeAchievements（三线达成度 — 封顶は财/名のみ）', () => {
  it('财/名は达成度 1.0 を超えても ENDING.CAP に封顶される', () => {
    const a = computeAchievements(600, 0, 120);
    expect(a.wealth).toBe(ENDING.CAP);
    expect(a.fame).toBe(ENDING.CAP);
  });

  it('侠は不封顶 — CAP を超える达成度をそのまま返す', () => {
    const a = computeAchievements(0, 40, 0);
    expect(a.xia).toBeGreaterThan(ENDING.CAP);
    expect(a.xia).toBe(40 / ENDING.XIA_GOAL);
  });

  it('目标未满は原値の比率（财 300/侠 32/名 80 を分母にする）', () => {
    const a = computeAchievements(150, 16, 40);
    expect(a.wealth).toBeCloseTo(0.5);
    expect(a.xia).toBeCloseTo(0.5);
    expect(a.fame).toBeCloseTo(0.5);
  });
});

describe('judgeEnding（argmax ＋ 封顶决胜）', () => {
  it('唯一 1.0 以上の线を结局にする', () => {
    // 财 360/300 = 1.2（封顶）、侠 0.625、名 0.5 → 财结局
    const j = judgeEnding(360, 20, 40, 'xia');
    expect(j.ending).toBe('wealth');
    expect(j.closeCall).toBe(false);
  });

  it('侠の未封顶达成度は财/名の封顶值を上回る（抉择纪律の兑现）', () => {
    // 财 1.2（封顶）/ 名 1.2（封顶）でも侠 40/32 = 1.25 が最高 → 侠结局
    const j = judgeEnding(360, 40, 96, 'wealth');
    expect(j.ending).toBe('xia');
  });

  it('复数线同为封顶值 → 开局志向线を优先（财志向）', () => {
    // 财 400/300 → 封顶、名 100/80 → 封顶、侠 10/32 → 同值群に非ず
    const j = judgeEnding(400, 10, 100, 'wealth');
    expect(j.achievements.wealth).toBe(ENDING.CAP);
    expect(j.achievements.fame).toBe(ENDING.CAP);
    expect(j.ending).toBe('wealth');
  });

  it('复数线同为封顶值 → 开局志向线を优先（名志向）', () => {
    const j = judgeEnding(400, 10, 100, 'fame');
    expect(j.ending).toBe('fame');
  });

  it('志向线が封顶同值群に含まれない场合は gdd 顺序（财/侠/名）の先頭', () => {
    // 侠志向でも侠が触顶していない → 财（记载顺序先頭）
    const j = judgeEnding(400, 10, 100, 'xia');
    expect(j.ending).toBe('wealth');
  });
});

describe('judgeEnding（险成分支）', () => {
  it('无一线 >= 1.0 → 最高线を结局とし closeCall=true', () => {
    // 财 200/300 ≈ 0.667 / 侠 10/32 ≈ 0.313 / 名 32/80 = 0.4 → 财结局＋险成
    const j = judgeEnding(200, 10, 32, 'fame');
    expect(j.ending).toBe('wealth');
    expect(j.closeCall).toBe(true);
  });

  it('最高线がちょうど 1.0 → 险成ではない', () => {
    const j = judgeEnding(300, 0, 0, 'xia');
    expect(j.achievements.wealth).toBe(1.0);
    expect(j.closeCall).toBe(false);
  });
});

describe('buildRunEndSummary（RunEndSummary 接线）', () => {
  it('runComplete: 结局/结局加成/险成を填める（封顶同值 → 志向决胜）', () => {
    const run = makeRun({ silver: 360, reputation: 96, xiaPoints: 30, ambition: 'fame' }, { battleWon: true });
    const summary = buildRunEndSummary(run, 'runComplete');
    expect(summary.ending).toBe('fame');
    expect(summary.endingBonus).toBe(ENDING.BONUS);
    expect(summary.closeCall).toBe(false);
  });

  it('总评分は未封顶原值 — buildRunEndSummary は silver/reputation の原值を保持する', () => {
    const run = makeRun({ silver: 600, reputation: 120, xiaPoints: 0, ambition: 'wealth' }, { battleWon: true });
    const summary = buildRunEndSummary(run, 'runComplete');
    expect(summary.silver).toBe(600);
    expect(summary.reputation).toBe(120);
    // 未封顶原值による评分（封顶 1.2 は评分に流さない — gdd「分数与进度」）
    const score = computeRunScore(createRunResult(summary));
    expect(score).toBe(Math.floor(600 * SCORE.WEIGHT_SILVER + 120 * SCORE.WEIGHT_REPUTATION +
      summary.staffPower * SCORE.WEIGHT_POWER + ENDING.BONUS));
  });

  it('险成の runComplete も结局と endingBonus を持つ（closeCall=true が RunEndSummary へ伝播）', () => {
    const run = makeRun({ silver: 200, reputation: 32, xiaPoints: 10, ambition: 'xia' }, { battleWon: true });
    const summary = buildRunEndSummary(run, 'runComplete');
    expect(summary.closeCall).toBe(true);
    expect(summary.ending).toBe('wealth');
    expect(summary.endingBonus).toBe(ENDING.BONUS);
  });

  it('败局（破产/终战败）は结局判定を行わない — ending なし・endingBonus 0', () => {
    const run = makeRun({ silver: 400, reputation: 100, xiaPoints: 40, ambition: 'wealth' });
    for (const kind of ['bankruptcy', 'finalBattleLoss'] as const) {
      const summary: RunEndSummary = buildRunEndSummary(run, kind);
      expect(summary.kind).toBe(kind);
      expect(summary.ending ?? null).toBeNull();
      expect(summary.closeCall ?? false).toBe(false);
      expect(summary.endingBonus).toBe(0);
    }
  });

  it('终战未胜利の runComplete 要求（手動「结束周目」経路）は结局判定を不発にする', () => {
    // CR-CODE iter1 finding 1 の回帰: finalBattle が無い（未開戦）/ lost の状态で
    // runComplete を要求しても三线 0 の argmax（wealth 险成）と结局加成を捏造しない
    const notFought = makeRun({ silver: 0, reputation: 0, xiaPoints: 0, ambition: 'fame' });
    const lost = { ...notFought, finalBattle: { ...enterBattle(notFought).finalBattle!, status: 'lost' as const } };
    for (const run of [notFought, lost]) {
      const summary = buildRunEndSummary(run, 'runComplete');
      expect(summary.kind).toBe('runComplete');
      expect(summary.ending ?? null).toBeNull();
      expect(summary.closeCall ?? false).toBe(false);
      expect(summary.endingBonus).toBe(0);
    }
  });
});

describe('metaProgression 连携（endings_seen 置位）', () => {
  it('runComplete の结局が endings_seen の该当下标に置位される', () => {
    const run = makeRun({ silver: 360, reputation: 96, xiaPoints: 30, ambition: 'fame' }, { battleWon: true });
    const summary = buildRunEndSummary(run, 'runComplete');
    const next = applyRunResult(createDefaultSaveData(), createRunResult(summary));
    expect(next.endings_seen[META_SAVE.ENDING_INDEX.fame]).toBe(true);
    expect(next.endings_seen[META_SAVE.ENDING_INDEX.wealth]).toBe(false);
  });

  it('败局は endings_seen を置位しない', () => {
    const run = makeRun({ silver: 400, reputation: 100, xiaPoints: 40, ambition: 'wealth' });
    const result = createRunResult(buildRunEndSummary(run, 'bankruptcy'));
    expect(result.ending).toBeNull();
  });

  it('终战未胜利の手動 runComplete も endings_seen を置位しない（統計埋め防止 — finding 1）', () => {
    const run = makeRun({ silver: 0, reputation: 0, xiaPoints: 0, ambition: 'fame' });
    const next = applyRunResult(
      createDefaultSaveData(),
      createRunResult(buildRunEndSummary(run, 'runComplete')),
    );
    expect(next.endings_seen.every((seen) => seen === false)).toBe(true);
  });
});
