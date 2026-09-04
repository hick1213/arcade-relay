/**
 * kitchen — 后厨系统（gdd「后厨系统」: 点单→DISH_PREP(n) 制菜→出餐口）。
 * 采购人数→当日可选菜种、掌勺手艺→制菜短缩（gdd「三属性的日间效果」）。
 * 纯函数・Phaser 非依赖。
 */
import { KITCHEN, MS_PER_SECOND } from '../config';
import type { KitchenState, RunState } from '../types';
import { craftReduction } from './dayEffects';

export function emptyKitchen(): KitchenState {
  return { tickets: [], ready: [] };
}

export function purchaserCount(run: RunState): number {
  return run.staff.filter((member) => member.post === 'purchaser').length;
}

/** 当日可选菜种数（菜号 1 起。教学期は TEACHING_DISH_CAP にclamp） */
export function availableDishKinds(run: RunState): number {
  const index = Math.min(purchaserCount(run), KITCHEN.PURCHASE_KINDS.length - 1);
  // index は PURCHASE_KINDS.length - 1 にclamp済み
  const kinds = KITCHEN.PURCHASE_KINDS[index] as number;
  if (run.day <= KITCHEN.TEACHING_LAST_DAY) {
    return Math.min(kinds, KITCHEN.TEACHING_DISH_CAP);
  }
  return kinds;
}

/** 掌勺手艺 = 当日店内（岗位≠修练）伙计中手艺最高者の值（gdd「三属性的日间效果」） */
export function headChefCraft(run: RunState): number {
  return run.staff.reduce(
    (max, member) => (member.post === 'training' ? max : Math.max(max, member.craft)),
    0,
  );
}

/** 菜号 n の价格 = MIN + (n−1)×(MAX−MIN)/(種類数−1)（gdd「数值表」DISH_PRICE_MIN/MAX） */
export function dishPrice(dishId: number): number {
  return (
    KITCHEN.DISH_PRICE_MIN +
    ((dishId - 1) * (KITCHEN.DISH_PRICE_MAX - KITCHEN.DISH_PRICE_MIN)) / (KITCHEN.DISH_COUNT - 1)
  );
}

/** DISH_PREP(n) = BASE + (n−1)×STEP、掌勺手艺で短缩（短缩率は craftReduction — CRAFT_CAP 封顶） */
export function prepTimeMs(dishId: number, craft: number): number {
  const reduction = craftReduction(craft);
  const seconds = KITCHEN.PREP_BASE_S + (dishId - 1) * KITCHEN.PREP_STEP_S;
  return seconds * (1 - reduction) * MS_PER_SECOND;
}

export function startPrep(
  kitchen: KitchenState,
  customerId: number,
  dishId: number,
  craft: number,
): KitchenState {
  return {
    ...kitchen,
    tickets: [
      ...kitchen.tickets,
      { customerId, dishId, remainingMs: prepTimeMs(dishId, craft) },
    ],
  };
}

/** delta 累计で制菜を進め、完成分を出餐口へ（conventions 规则 3） */
export function advanceKitchen(kitchen: KitchenState, deltaMs: number): KitchenState {
  const tickets = kitchen.tickets.map((ticket) => ({
    ...ticket,
    remainingMs: ticket.remainingMs - deltaMs,
  }));
  const finished = tickets.filter((ticket) => ticket.remainingMs <= 0);
  if (finished.length === 0) {
    return { ...kitchen, tickets };
  }
  return {
    tickets: tickets.filter((ticket) => ticket.remainingMs > 0),
    ready: [
      ...kitchen.ready,
      ...finished.map((ticket) => ({ customerId: ticket.customerId, dishId: ticket.dishId })),
    ],
  };
}

/**
 * 上菜完了で出餐口から該当客の菜を 1 枚だけ引き取る（多菜客人＝镖师の 2 菜目は
 * 1 枚ずつ別の上菜动作で運ぶ — S-16）。
 * - dishId 指定時: 該当菜を 1 枚（呼出側 — customerFlow の serving 完了 — は常に指定）。
 * - 未指定時: 該当客の菜のうち先頭の 1 枚のみ（「全量引き取り」ではない。JSDoc を
 *   実装と一致させた — CR-CODE iteration 1 指摘）。
 * 該当菜が無い場合は kitchen をそのまま返す（no-op）。
 */
export function takeReadyDish(
  kitchen: KitchenState,
  customerId: number,
  dishId?: number,
): KitchenState {
  const index = kitchen.ready.findIndex(
    (dish) => dish.customerId === customerId && (dishId === undefined || dish.dishId === dishId),
  );
  if (index === -1) {
    return kitchen;
  }
  return { ...kitchen, ready: kitchen.ready.filter((_, i) => i !== index) };
}
