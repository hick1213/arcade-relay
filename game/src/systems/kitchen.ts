/**
 * kitchen — 后厨系统（gdd「后厨系统」: 点单→DISH_PREP(n) 制菜→出餐口）。
 * 采购人数→当日可选菜种、掌勺手艺→制菜短缩（gdd「三属性的日间效果」）。
 * 纯函数・Phaser 非依赖。
 */
import { KITCHEN, MS_PER_SECOND } from '../config';
import type { KitchenState, RunState } from '../types';

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

/** DISH_PREP(n) = BASE + (n−1)×STEP、掌勺手艺で短缩（CRAFT_CAP clamp） */
export function prepTimeMs(dishId: number, craft: number): number {
  const reduction = Math.min(KITCHEN.CRAFT_CAP, KITCHEN.CRAFT_FACTOR * craft);
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

/** 上菜完了で出餐口から引き取り */
export function takeReadyDish(kitchen: KitchenState, customerId: number): KitchenState {
  return { ...kitchen, ready: kitchen.ready.filter((dish) => dish.customerId !== customerId) };
}
