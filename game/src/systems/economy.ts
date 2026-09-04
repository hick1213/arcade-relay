/**
 * economy — 经济系统（S-08。gdd「经济系统」: 银子/声望加算、夜间工钱、破产判定）。
 * 纯函数・Phaser 非依赖。
 */
import { ENDING, ECONOMY, RESULT } from '../config';
import { judgeEnding } from './ending';
import type { RunEndKind, RunEndSummary, RunState } from '../types';

export function applyDeltas(run: RunState, silverDelta: number, reputationDelta: number): RunState {
  return {
    ...run,
    silver: run.silver + silverDelta,
    reputation: run.reputation + reputationDelta,
  };
}

/** 当日工钱（DAILY_WAGE_PER_STAFF × 在编 5 名 = 30 两/日 — gdd「数值表」） */
export function dailyWage(): number {
  return ECONOMY.DAILY_WAGE_PER_STAFF * ECONOMY.ON_ROSTER_STAFF_COUNT;
}

/** 夜间结算の工钱扣除（daySummary.wage に表示用としても記録） */
export function chargeNightWage(run: RunState): RunState {
  const wage = dailyWage();
  return { ...run, silver: run.silver - wage, daySummary: { ...run.daySummary, wage } };
}

/** 破产判定（silver < 0 の瞬间 — gdd「胜负条件」。夜结算後と收钱/事件 Δ 後に呼ばれる） */
export function isBankrupt(run: RunState): boolean {
  return run.silver < 0;
}

/** 全伙计三属性合计（staffPowerTotal — 終戦/总评分の入力） */
export function staffPowerTotal(run: RunState): number {
  return run.staff.reduce((sum, member) => sum + member.speed + member.craft + member.stamina, 0);
}

/** 全伙计单属性の最大值（S-21 ACH-06 判定源 — gdd「成就」表。败局でも計上） */
export function maxStaffStat(run: RunState): number {
  return run.staff.reduce(
    (max, member) => Math.max(max, member.speed, member.craft, member.stamina),
    0,
  );
}

/**
 * 周目终结摘要（ResultScene 迁移载荷）。
 * - runComplete: S-20 结局判定（judgeEnding — 达成度 argmax、封顶同值は志向决胜）→
 *   ending と endingBonus（ENDING.BONUS）と closeCall（险成标注）を填める。
 *   **前提 = 终战胜利**（gdd「胜负条件」: 「终战胜利 → 结局判定」）—
 *   `run.finalBattle?.status !== 'won'` の runComplete 要求（PausePanel「结束周目」の
 *   手動終了経路 = GameScene）は结局判定を行わない: ending なし・endingBonus 0・closeCall なし
 *   （破産/终战败と同型の败局扱い。applyRunResult も endings_seen を置位しない）。
 *   CR-CODE iter1 finding 1: ゲートなしでは第 1 日朝の pause → 手動終了だけで
 *   三线 0 の argmax（wealth 险成）＋结局加成 +200 の persist＋endings_seen 置位が可能だった。
 * - 败局（破产/终战败）: 结局判定は行わない — ending なし・endingBonus 0
 *   （RESULT.ENDING_BONUS_PLACEHOLDER。评分公式の结局加成項が 0 になる）。
 * - 总评分は**未封顶原值**（silver/reputation はそのまま — CAP は结局判定にのみ作用 — gdd「分数与进度」）。
 */
export function buildRunEndSummary(run: RunState, kind: RunEndKind): RunEndSummary {
  const finalBattleWon = run.finalBattle?.status === 'won';
  if (kind !== 'runComplete' || !finalBattleWon) {
    return {
      kind,
      silver: run.silver,
      reputation: run.reputation,
      staffPower: staffPowerTotal(run),
      maxStaffStat: maxStaffStat(run),
      endingBonus: RESULT.ENDING_BONUS_PLACEHOLDER,
      ending: null,
    };
  }
  const judgment = judgeEnding(run.silver, run.xiaPoints, run.reputation, run.ambition);
  return {
    kind,
    silver: run.silver,
    reputation: run.reputation,
    staffPower: staffPowerTotal(run),
    maxStaffStat: maxStaffStat(run),
    endingBonus: ENDING.BONUS,
    ending: judgment.ending,
    closeCall: judgment.closeCall,
  };
}
