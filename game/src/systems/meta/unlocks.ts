/**
 * unlocks — 解锁判定（S-22。gdd「解锁」表 UNL-01/02）。
 *
 * - 引擎无关层: 禁止 import Phaser、禁止引用 localStorage。接收值并返回新值（纯函数）。
 * - 判定时机 = applyRunResult（周目终结）。阈值の唯一来源 = config.META_SAVE.UNLOCK_ENDINGS_REQUIRED
 *   （UNL-01 = endings_seen 计数 ≥ 1（1–2）/ UNL-02 = ≥ 2（2–3）— 调参只动 config）。
 * - 已解锁以 OR 合成保持: 不回落（endings_seen 是累积置位、本判定自身も単调 — 二重防护）。
 */
import { META_SAVE } from '../../config';
import type { UnlockId } from './metaTypes';

/** 解锁判定结果（SaveData.unlocks と同形） */
export type UnlockJudgment = Readonly<Record<UnlockId, boolean>>;

/** 结局图鉴の达成種类数（endings_seen 的 true 数 — gdd「解锁」表の判定式「endings_seen 计数」） */
export const endingsSeenCount = (endingsSeen: readonly boolean[]): number =>
  endingsSeen.filter((seen) => seen === true).length;

/** 本周目终结时点的解锁判定（endings_seen 传入 applyRunResult 更新后的值 — 本次点亮第 2 格的瞬间 UNL-02 も成立） */
export const judgeUnlocks = (endingsSeen: readonly boolean[]): UnlockJudgment =>
  META_SAVE.UNLOCK_IDS.reduce(
    (acc, id) => ({
      ...acc,
      [id]: endingsSeenCount(endingsSeen) >= META_SAVE.UNLOCK_ENDINGS_REQUIRED[id],
    }),
    {} as Record<UnlockId, boolean>,
  );

/** 已解锁保持的 OR 合成（SaveData.unlocks の新值 — 一度解锁した候補は回落しない） */
export const mergeUnlocks = (
  before: UnlockJudgment,
  judged: UnlockJudgment,
): UnlockJudgment =>
  META_SAVE.UNLOCK_IDS.reduce(
    (acc, id) => ({ ...acc, [id]: before[id] === true || judged[id] === true }),
    {} as Record<UnlockId, boolean>,
  );
