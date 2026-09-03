/**
 * economy — 经济系统（S-08。gdd「经济系统」: 银子/声望加算、夜间工钱、破产判定）。
 * 纯函数・Phaser 非依赖。
 */
import { ECONOMY, RESULT } from '../config';
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

/** 周目终结摘要（ResultScene 迁移载荷。endingBonus は S-20 结局判定接线まで占位 0） */
export function buildRunEndSummary(run: RunState, kind: RunEndKind): RunEndSummary {
  return {
    kind,
    silver: run.silver,
    reputation: run.reputation,
    staffPower: staffPowerTotal(run),
    endingBonus: RESULT.ENDING_BONUS_PLACEHOLDER,
  };
}
