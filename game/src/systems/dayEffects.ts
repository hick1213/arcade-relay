/**
 * dayEffects — 三属性的日间效果（S-18。gdd「三属性的日间效果」P-02: 修练后日间可见差异）。
 *
 * - 速度: 点单/上菜/收钱动作耗时倍率 = max(ACTION_FACTOR_MIN, 1 − SPEED_FACTOR×速度)
 * - 手艺: 制菜耗时短缩率 = min(CRAFT_CAP, CRAFT_FACTOR×掌勺手艺)（掌勺 = 当日店内
 *   岗位≠修练的伙计中手艺最高者 — kitchen.headChefCraft）
 * - 体力: 疲劳时の动作耗时倍率 = 1 + (FATIGUE_PENALTY−1)×(1 − STAMINA_RESIST×体力)
 *   （减免项は 1 で封顶 — 体力足够高则疲劳完全无效＝免疫。无疲劳时体力无日间效果）
 *
 * 三属性は全部同时具有日间效果与终战战力贡献（playerPower = Σ(速+艺+体) は不変 —
 * 日间效果は P-02 可见差异の载体、终战量纲を変えない）。
 * 算式の境界（封顶/免疫）は本モジュールに一元化し、tests/dayEffects.test.ts が参照する。
 * 纯函数・Phaser 非依赖。
 */
import { KITCHEN, STAFF } from '../config';

/** 速度の动作耗时倍率（下限 ACTION_FACTOR_MIN で封顶 — 高速度でも 0 秒にならない） */
export function speedMultiplier(speed: number): number {
  return Math.max(STAFF.ACTION_FACTOR_MIN, 1 - STAFF.SPEED_FACTOR * speed);
}

/** 手艺の制菜耗时短缩率（上限 CRAFT_CAP で封顶 — 高手艺でも制菜时间は 0 にならない） */
export function craftReduction(craft: number): number {
  return Math.min(KITCHEN.CRAFT_CAP, KITCHEN.CRAFT_FACTOR * craft);
}

/**
 * 体力の疲劳时动作耗时倍率（gdd 数值表 FATIGUE_PENALTY/STAMINA_RESIST）。
 * 减免项 = STAMINA_RESIST×体力 を 1 で封顶 — 减免が 1 に達したら倍率 1.0＝免疫。
 * fatigued=false 时は 1（体力は疲劳時のみ日间效果を持つ — gdd 注记）。
 */
export function fatigueMultiplier(stamina: number, fatigued: boolean): number {
  if (!fatigued) {
    return 1;
  }
  const resist = Math.min(1, STAFF.STAMINA_RESIST * stamina);
  return 1 + (STAFF.FATIGUE_PENALTY - 1) * (1 - resist);
}
