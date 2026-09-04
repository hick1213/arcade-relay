/**
 * finalBattle — 终战系统（S-19。gdd「胜负条件」: 第 20 日夜「迎战」→ 3 回合自动战力对撞）。
 *
 * - 纯函数・Phaser 非依赖（systems 引擎无关层）。随机抽样は注入式（random 引数 —
 *   单测で确定性验证でき、Math.random を既定値に持つのみ）。
 * - 单回合算式（gdd）: playerPower/3 ×(1±BATTLE_VARIANCE) vs enemyPower/3 ×(1±BATTLE_VARIANCE)。
 *   playerPower = Σ(全伙计 速度+手艺+体力) ＋ 援助加成（雇镖师援助 ＋BATTLE_AID_POWER）。
 * - 先取 BATTLE_ROUNDS_TO_WIN（2）胜者胜。3 回合上限。
 * - 开战前快照（重试当日の恢复源）は「迎战」时点（＝夜结算完成直後）で生成する
 *   （gdd「重新开始」: 快照在第 20 日夜结算完成时生成）。
 * - 战败 = ended(finalBattleLoss) — applyRunResult は GameScene が不発（run 快照保留）、
 *   ResultScene「重试当日」→ createBattleRetryRun で快照復帰。战胜 = ended(runComplete)
 *   （结局判定＝S-20 が ending を埋める — 本 story では既有の占位経路を踏む）。
 */
import {
  BATTLE_AID_COST,
  BATTLE_AID_POWER,
  BATTLE_ROUNDS,
  BATTLE_ROUNDS_TO_WIN,
  BATTLE_VARIANCE,
  ENEMY_POWER,
} from '../config';
import type {
  BattleRoundResult,
  FinalBattleSnapshot,
  FinalBattleState,
  RunState,
} from '../types';
import { buildRunEndSummary, staffPowerTotal } from './economy';

/** 单回合の战力抽样: power/3 ×(1±BATTLE_VARIANCE)（random は 0–1 の一様。端点を両山根に含む） */
function rollPower(power: number, random: () => number): number {
  return (power / BATTLE_ROUNDS) * (1 + (random() * 2 - 1) * BATTLE_VARIANCE);
}

/**
 * 开战前快照（gdd「重新开始」: 银子/声望/侠点/伙计状态/志向）。
 * staff は岗位・疲劳込みの参照をそのまま保持（快照時点の状态 — 復帰側で複元）。
 */
export function captureSnapshot(run: RunState): FinalBattleSnapshot {
  return {
    ambition: run.ambition,
    silver: run.silver,
    reputation: run.reputation,
    xiaPoints: run.xiaPoints,
    staff: run.staff,
  };
}

/** 现在の玩家战力（staffPowerTotal ＋ 援助加成。状態に持たず都度导出 — 二重管理禁止） */
export function playerPowerOf(run: RunState): number {
  const aid = run.finalBattle !== null && run.finalBattle.aidHired ? BATTLE_AID_POWER : 0;
  return staffPowerTotal(run) + aid;
}

/** 「雇镖师援助」の可否（未雇入かつ银子 ≥ BATTLE_AID_COST — acceptance「可用且银子不足时禁用」） */
export function canHireAid(run: RunState): boolean {
  return run.finalBattle !== null && !run.finalBattle.aidHired && run.silver >= BATTLE_AID_COST;
}

/** 终战状态の初期値（prelude。開戦前快照をここで生成 — gdd「快照在第 20 日夜结算完成时生成」） */
export function createBattleState(run: RunState): FinalBattleState {
  return {
    status: 'prelude',
    aidHired: false,
    rounds: [],
    preSnapshot: captureSnapshot(run),
  };
}

/** 第 20 日夜「迎战」→ 開戦前選択（nightStage='battle'。再入力は無視 — べき等ガード） */
export function enterBattle(run: RunState): RunState {
  if (run.finalBattle !== null) {
    return run;
  }
  return { ...run, nightStage: 'battle', finalBattle: createBattleState(run) };
}

/** 「雇镖师援助」: −BATTLE_AID_COST ／ ＋BATTLE_AID_POWER（1 回のみ。不足/雇入济みは不発） */
export function hireAid(run: RunState): RunState {
  const battle = run.finalBattle;
  if (battle === null || battle.aidHired || run.silver < BATTLE_AID_COST) {
    return run;
  }
  return { ...run, silver: run.silver - BATTLE_AID_COST, finalBattle: { ...battle, aidHired: true } };
}

/**
 * 单回合の对撞（playerRoll = playerPower/3 ×(1±BATTLE_VARIANCE)、enemyRoll 同型。
 * 両者独立に抽样、同值は玩家侧胜 — 判断事項。roll 值も返す（单测の确定性验证用））
 */
export function resolveRound(
  round: number,
  playerPower: number,
  enemyPower: number,
  random: () => number,
): BattleRoundResult {
  const playerRoll = rollPower(playerPower, random);
  const enemyRoll = rollPower(enemyPower, random);
  return { round, playerRoll, enemyRoll, outcome: playerRoll >= enemyRoll ? 'playerWin' : 'enemyWin' };
}

/**
 * 「开战」: 3 回合自动对撞（先取 2 胜 — 早期决着。败 = ended(finalBattleLoss)／
 * 胜 = ended(runComplete) — 结局判定 S-20 が ending を埋める）。
 */
export function fight(run: RunState, random: () => number = Math.random): RunState {
  const battle = run.finalBattle;
  if (battle === null || battle.status !== 'prelude') {
    return run;
  }
  const power = playerPowerOf(run);
  let rounds: readonly BattleRoundResult[] = [];
  let playerWins = 0;
  let enemyWins = 0;
  for (let round = 1; round <= BATTLE_ROUNDS; round += 1) {
    if (playerWins >= BATTLE_ROUNDS_TO_WIN || enemyWins >= BATTLE_ROUNDS_TO_WIN) {
      break;
    }
    const result = resolveRound(round, power, ENEMY_POWER, random);
    if (result.outcome === 'playerWin') {
      playerWins += 1;
    } else {
      enemyWins += 1;
    }
    rounds = [...rounds, result];
  }
  const status = playerWins >= BATTLE_ROUNDS_TO_WIN ? 'won' : 'lost';
  const resolved: RunState = { ...run, finalBattle: { ...battle, status, rounds } };
  return {
    ...resolved,
    ended: buildRunEndSummary(resolved, status === 'lost' ? 'finalBattleLoss' : 'runComplete'),
  };
}
