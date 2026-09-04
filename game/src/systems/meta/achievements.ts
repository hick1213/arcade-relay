/**
 * achievements — 成就判定（S-21。gdd「成就」表 ACH-01～06）。
 *
 * - 引擎无关层: 禁止 import Phaser、禁止引用 localStorage。接收值并返回新值（纯函数）。
 * - 判定时机 = applyRunResult（周目终结 — gdd「成就」表无局内即时判定位）。
 * - 已达成的成就以 OR 合成保持: 不重复触发、也不因后续周目回落（acceptance）。
 * - 阈值的唯一来源 = config（ACH-05 = META_SAVE.ACH05_REPUTATION / ACH-06 = STAFF.STAT_MAX —
 *   调参只动 config）。
 */
import { META_SAVE, STAFF } from '../../config';
import type { AmbitionId } from '../../types';
import type { AchievementId } from './metaTypes';

/** 成就判定的输入（applyRunResult 时点的周目终值） */
export interface AchievementInput {
  /** 达成结局（财/侠/名）。败局 = null（ACH-01～03 不判定 — gdd「成就」表） */
  readonly ending: AmbitionId | null;
  /** 本周目终值声望（ACH-05） */
  readonly reputation: number;
  /** 全伙计单属性的最大值（ACH-06 — economy.maxStaffStat 的产物） */
  readonly maxStaffStat: number;
}

/** 结局图鉴全格点亮（ACH-04 = ACH-01∧02∧03 — gdd「成就」表「全结局图鉴完成」） */
const allEndingsSeen = (endingsSeen: readonly boolean[]): boolean =>
  Object.values(META_SAVE.ENDING_INDEX).every((index) => endingsSeen[index] === true);

/**
 * 本周目时点的达成判定（ACH-01～06）。
 * endings_seen 传入 applyRunResult 更新后的值（本次周目点亮第 3 格的瞬间 ACH-04 也成立）。
 */
export const judgeAchievements = (
  input: AchievementInput,
  endingsSeen: readonly boolean[],
): Readonly<Record<AchievementId, boolean>> => ({
  'ACH-01': input.ending === 'wealth',
  'ACH-02': input.ending === 'xia',
  'ACH-03': input.ending === 'fame',
  'ACH-04': allEndingsSeen(endingsSeen),
  'ACH-05': input.reputation >= META_SAVE.ACH05_REPUTATION,
  'ACH-06': input.maxStaffStat >= STAFF.STAT_MAX,
});

/**
 * 已达成保持的 OR 合成（SaveData.achievements の新值 — gdd「存档数据方针」achievements）。
 * 一度达成的成就在后续周目保持 true（acceptance「已达成不重复触发」）。
 */
export const mergeAchievements = (
  before: Readonly<Record<AchievementId, boolean>>,
  judged: Readonly<Record<AchievementId, boolean>>,
): Readonly<Record<AchievementId, boolean>> =>
  META_SAVE.ACHIEVEMENT_IDS.reduce(
    (acc, id) => ({ ...acc, [id]: before[id] === true || judged[id] === true }),
    {} as Record<AchievementId, boolean>,
  );

/** 新达成的成就 id 一览（达成反馈源 — SFX 再生的判定用。纯函数） */
export const diffAchievements = (
  before: Readonly<Record<AchievementId, boolean>>,
  after: Readonly<Record<AchievementId, boolean>>,
): readonly AchievementId[] =>
  META_SAVE.ACHIEVEMENT_IDS.filter((id) => before[id] !== true && after[id] === true);
