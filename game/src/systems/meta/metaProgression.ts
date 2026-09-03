/**
 * metaProgression — 元进度 reducer（S-14。gdd「元进度（游戏外）」）。
 *
 * - 引擎无关层: 禁止 import Phaser、禁止引用 localStorage。接收值并返回新值（不可变更新）。
 * - applyRunResult: 接收周目终结时的 RunResult，返回更新后的 SaveData（纯函数 —
 *   persist 的时机与 I/O 在 persistence/ 与场景接线层）。
 * - 成就判定（ACH-01～06 = S-21）与解锁（UNL-01/02 = S-22）的置位在本 reducer 扩展；
 *   endings_seen 置位是本 story 范围（gdd「统计」表）。
 */
import { META_SAVE, SCORE } from '../../config';
import type { AmbitionId, RunEndSummary } from '../../types';
import type { SaveData } from './metaTypes';

/** 周目终结时 metaProgression 的输入（RunEndSummary ＋ 结局/统计源。S-20/S-23 接线时扩展） */
export interface RunResult {
  readonly kind: RunEndSummary['kind'];
  readonly silver: number;
  readonly reputation: number;
  readonly staffPower: number;
  readonly endingBonus: number;
  /** 达成结局（财/侠/名）。破产・终战败 = null；结局判定接线（S-20）前 prototype 为 null */
  readonly ending: AmbitionId | null;
  /** 本周目累计服务成功客数（served_total 累加源 — gdd「统计」。run 快照接线 S-23 前可省略） */
  readonly servedThisRun?: number;
}

/**
 * 总评分 = floor(silver×0.5 + rep×10 + power×20 + endingBonus)（gdd「分数与进度」）。
 * 权重权威 = config.SCORE（ui/ResultPanel 的显示侧派生与同一常量 — 调参只动 config）。
 */
export const computeRunScore = (result: RunResult): number =>
  Math.floor(
    result.silver * SCORE.WEIGHT_SILVER +
      result.reputation * SCORE.WEIGHT_REPUTATION +
      result.staffPower * SCORE.WEIGHT_POWER +
      result.endingBonus,
  );

/** RunEndSummary（Systems 层 buildRunEndSummary 的产物）→ RunResult（结局/统计源接线前） */
export const createRunResult = (summary: RunEndSummary): RunResult => ({
  kind: summary.kind,
  silver: summary.silver,
  reputation: summary.reputation,
  staffPower: summary.staffPower,
  endingBonus: summary.endingBonus,
  // 结局判定（S-20）接线前 prototype 无结局 — endings_seen 不置位（判断事項）
  ending: null,
});

/** endings_seen 的下标（config.META_SAVE.ENDING_INDEX — 调整只动 config） */
const endingIndex = (ending: AmbitionId): number => META_SAVE.ENDING_INDEX[ending];

/**
 * 周目终结 → 新 SaveData（gdd「统计」表的更新时机 + run 快照清除）。
 * - best_score = max(历史, 本周目 score)
 * - finished_runs +1 / silver_peak・rep_peak = max / served_total 累加
 * - endings_seen: 达成对应结局时置位
 * - run := null（周目终结 — Menu 不再显示「继续周目」）
 */
export const applyRunResult = (save: SaveData, result: RunResult): SaveData => {
  const score = computeRunScore(result);
  const endingsSeen = save.endings_seen.map((seen, index) =>
    result.ending !== null && index === endingIndex(result.ending) ? true : seen,
  );
  return {
    ...save,
    best_score: Math.max(save.best_score, score),
    stats: {
      finished_runs: save.stats.finished_runs + 1,
      silver_peak: Math.max(save.stats.silver_peak, result.silver),
      rep_peak: Math.max(save.stats.rep_peak, result.reputation),
      served_total: save.stats.served_total + (result.servedThisRun ?? 0),
    },
    endings_seen: endingsSeen,
    // run 快照清除（gdd「存档数据方针」。续玩保存 = S-23 — 本 story 不写入 run）
    run: null,
    // recovered 是会话内标志（损坏恢复通知只在恢复当次显示）— persist 快照恒 false
    recovered: false,
  };
};
