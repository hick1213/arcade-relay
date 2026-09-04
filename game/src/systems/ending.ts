/**
 * ending — 结局判定系统（S-20。gdd「胜负条件」终战胜利 → 结局判定）。
 *
 * - 引擎无关层: 禁止 import Phaser、禁止引用 localStorage。接收值并返回新值（纯函数）。
 * - 三线达成度: 财 = min(silverEnd / SILVER_GOAL, CAP)、侠 = xiaPoints / XIA_GOAL（**不封顶**
 *   — 侠点无被动来源、上限即抉择纪律的体现）、名 = min(repEnd / REP_GOAL, CAP)。
 *   封顶理由（gdd）: 财/名存在被动累积（正常经营即可达 1.4–2×）、不封顶则 argmax 恒偏向被动线、
 *   志向选择失去结局意义（P-03 志向决胜）。
 * - **总评分使用未封顶原值**（CAP 只作用于结局判定 — buildRunEndSummary 传入的 silver/reputation
 *   原值そのまま、本系统の达成度は评分に流さない — gdd「分数与进度」）。
 */
import { ENDING } from '../config';
import type { AmbitionId } from '../types';

/** 三线达成度（下标 = gdd 记载顺序 财/侠/名） */
export interface EndingAchievements {
  readonly wealth: number;
  readonly xia: number;
  readonly fame: number;
}

/** 结局判定结果（buildRunEndSummary が RunEndSummary へ展开する） */
export interface EndingJudgment {
  /** 达成结局（argmax 线 — 决胜规则は judgeEnding の注釈） */
  readonly ending: AmbitionId;
  /** 三线达成度（财/名封顶。评分には使わない — 参照・单测・显示拡張用の真值） */
  readonly achievements: EndingAchievements;
  /** 险成: 三线とも达成度 < ACHIEVED_THRESHOLD（结局标题に「（险成）」标注 — 显示側へ伝播） */
  readonly closeCall: boolean;
}

/** 三线达成度（封顶は财/名のみ — 侠は不封顶。侠は整数/32 の二進分数で CAP に一致し得ない） */
export function computeAchievements(
  silver: number,
  xiaPoints: number,
  reputation: number,
): EndingAchievements {
  return {
    wealth: Math.min(silver / ENDING.SILVER_GOAL, ENDING.CAP),
    xia: xiaPoints / ENDING.XIA_GOAL,
    fame: Math.min(reputation / ENDING.REP_GOAL, ENDING.CAP),
  };
}

/** 达成度の线序（gdd 记载顺序 财/侠/名。非封顶同值の安定 tie-break に使用 — 判断事項） */
const ACHIEVEMENT_ORDER: readonly AmbitionId[] = ['wealth', 'xia', 'fame'];

/**
 * argmax 取结局（决胜规则 — gdd「胜负条件」）:
 * 1. 复数线同为封顶值（达成度 >= CAP。封顶线はCAPそのものを返すので同值=封顶）时
 *    以开局志向线优先（P-03 志向决胜 — 封顶后多线同时触顶成为常态、由志向决胜）。
 *    志向线が同值群に含まれない場合は (2) へ落ちる。
 * 2. 非封顶同值（侠が絡む稀な同点 — gdd 未規定）は gdd 记载顺序（财/侠/名）の先頭を取る
 *    （决定论的 tie-break。判断事項として報告済み）。
 * - 无一线 >= ACHIEVED_THRESHOLD でも最高线をそのまま结局とし closeCall を立てる（「险成」）。
 */
export function judgeEnding(
  silver: number,
  xiaPoints: number,
  reputation: number,
  ambition: AmbitionId,
): EndingJudgment {
  const achievements = computeAchievements(silver, xiaPoints, reputation);
  const entries = ACHIEVEMENT_ORDER.map((id) => ({ id, value: achievements[id] }));
  const top = entries.reduce((max, entry) => Math.max(max, entry.value), 0);
  const tied = entries.filter((entry) => entry.value === top);
  const first = tied[0];
  if (first === undefined) {
    // ACHIEVEMENT_ORDER は非空のため到達不能 — 安全側として志向線を返す
    return { ending: ambition, achievements, closeCall: top < ENDING.ACHIEVED_THRESHOLD };
  }
  const winner =
    top >= ENDING.CAP && tied.some((entry) => entry.id === ambition) ? ambition : first.id;
  return {
    ending: winner,
    achievements,
    closeCall: top < ENDING.ACHIEVED_THRESHOLD,
  };
}
