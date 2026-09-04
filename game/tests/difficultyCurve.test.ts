/**
 * difficultyCurve.test.ts — S-16 难度曲线全阶段与全客人类型の验收测试（systems 层纯逻辑）。
 *
 * - D1–3/D4–9/D10–15/D16–20 の到達间隔・基礎耐心が config 阶段常量と一一对应。
 * - 镖师: 第 4 日起（点 2 菜、耐心 ×1.3、離店 −3）。
 * - 老饕: 第 7 日起（高级菜 4〜6、耐心 ×0.8、離店 −4、服务 +2、菜种 <4 で不生成）。
 * - 教学期 TEACHING_DISH_CAP=3、無采购 −10s 耐心。
 * - 单日日间 3 分钟内に読み切れる（快进测试で 180s 相位が夜间へ迁移 — 计时不超时）。
 *
 * 运行: cd game && npm test（vitest run）
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CUSTOMER, KITCHEN, MS_PER_SECOND } from '../src/config';
import {
  advanceDay,
  basePatienceSecondsForDay,
  dispatchToCollect,
  dispatchToOrder,
  dispatchToServe,
  gourmetWeightForDay,
  intervalSecondsForDay,
  rollCustomerType,
} from '../src/systems/customerFlow';
import { availableDishKinds } from '../src/systems/kitchen';
import { advanceRun, confirmAmbition, createInitialRun } from '../src/systems/runEngine';
import { isFinalBattleNight } from '../src/systems/dayCycle';
import type { CustomerState, RunState, StaffPost } from '../src/types';

afterEach(() => {
  vi.restoreAllMocks();
});

/** 指定日の日间 run（到达タイマーはテスト内で制御するため長めにセット） */
function makeDayRun(day: number, posts: readonly StaffPost[]): RunState {
  const base = confirmAmbition(createInitialRun(), 'wealth');
  return {
    ...base,
    day,
    phase: 'day',
    phaseElapsedMs: 0,
    staff: base.staff.map((member, i) => ({ ...member, post: posts[i] ?? 'standby' })),
    customers: [],
    kitchen: { tickets: [], ready: [] },
    waiterActions: [],
    arrivalTimerMs: 600_000,
    customerSeq: 0,
    finalBattleNight: isFinalBattleNight(day),
  };
}

describe('S-16 难度曲线: 阶段常量（gdd「难度曲线」表と一一对应）', () => {
  it('到達间隔は 12/10/8/7s の 4 段階（插值なし・第 20 日は D16_20 を沿用）', () => {
    const cases: ReadonlyArray<[day: number, seconds: number]> = [
      [1, CUSTOMER.INTERVAL_D1_3_S],
      [3, CUSTOMER.INTERVAL_D1_3_S],
      [4, CUSTOMER.INTERVAL_D4_9_S],
      [9, CUSTOMER.INTERVAL_D4_9_S],
      [10, CUSTOMER.INTERVAL_D10_15_S],
      [15, CUSTOMER.INTERVAL_D10_15_S],
      [16, CUSTOMER.INTERVAL_D16_20_S],
      [20, CUSTOMER.INTERVAL_D16_20_S],
    ];
    for (const [day, seconds] of cases) {
      expect(intervalSecondsForDay(day)).toBe(seconds);
    }
    expect([
      CUSTOMER.INTERVAL_D1_3_S,
      CUSTOMER.INTERVAL_D4_9_S,
      CUSTOMER.INTERVAL_D10_15_S,
      CUSTOMER.INTERVAL_D16_20_S,
    ]).toEqual([12, 10, 8, 7]);
  });

  it('基礎耐心は 50/45/40/35s の 4 段階', () => {
    const cases: ReadonlyArray<[day: number, seconds: number]> = [
      [1, CUSTOMER.PATIENCE_D1_3_S],
      [3, CUSTOMER.PATIENCE_D1_3_S],
      [4, CUSTOMER.PATIENCE_D4_9_S],
      [9, CUSTOMER.PATIENCE_D4_9_S],
      [10, CUSTOMER.PATIENCE_D10_15_S],
      [15, CUSTOMER.PATIENCE_D10_15_S],
      [16, CUSTOMER.PATIENCE_D16_20_S],
      [20, CUSTOMER.PATIENCE_D16_20_S],
    ];
    for (const [day, seconds] of cases) {
      expect(basePatienceSecondsForDay(day)).toBe(seconds);
    }
    expect([
      CUSTOMER.PATIENCE_D1_3_S,
      CUSTOMER.PATIENCE_D4_9_S,
      CUSTOMER.PATIENCE_D10_15_S,
      CUSTOMER.PATIENCE_D16_20_S,
    ]).toEqual([50, 45, 40, 35]);
  });
});

/** 跑堂动作が空になるまで delta 累计で流す（移动/动作は 1 呼出で 1 段階しか進まない） */
function settle(run: RunState, maxSteps = 240): RunState {
  let current = run;
  for (let i = 0; i < maxSteps && current.waiterActions.length > 0; i += 1) {
    current = advanceDay(current, 500);
  }
  return current;
}

describe('S-16 教学期上限と無采购惩罚', () => {
  it('第 1–3 日は菜种 = min(PURCHASE_KINDS_x, TEACHING_DISH_CAP=3)、第 4 日で解除', () => {
    const teaching = makeDayRun(2, ['standby', 'standby', 'standby', 'purchaser', 'standby']);
    expect(availableDishKinds(teaching)).toBe(
      Math.min(KITCHEN.PURCHASE_KINDS[1], KITCHEN.TEACHING_DISH_CAP),
    );
    const after = makeDayRun(4, ['standby', 'standby', 'purchaser', 'purchaser', 'standby']);
    expect(availableDishKinds(after)).toBe(KITCHEN.PURCHASE_KINDS[2]);
  });

  it('無采购の日は基礎耐心 −10s（第 1 日: 50 → 40s）', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const noPurchase = makeDayRun(1, ['waiter', 'standby', 'standby', 'standby', 'standby']);
    const arrived = advanceDay({ ...noPurchase, arrivalTimerMs: 0 }, 16);
    const customer = arrived.customers[0] as CustomerState;
    expect(customer.typeId).toBe('regular');
    expect(customer.maxPatienceMs).toBe(
      (CUSTOMER.PATIENCE_D1_3_S - CUSTOMER.NO_PURCHASE_PATIENCE_PENALTY_S) * MS_PER_SECOND,
    );
  });
});

describe('S-16 镖师（第 4 日起・点 2 菜・耐心 ×1.3）', () => {
  it('第 3 日は权重 0 で不生成、第 4 日に抽選で生成', () => {
    expect(gourmetWeightForDay(3)).toBe(0);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const early = makeDayRun(3, ['waiter', 'standby', 'standby', 'purchaser', 'standby']);
    expect(rollCustomerType(early)).toBe('regular');
    const day4 = makeDayRun(4, ['waiter', 'standby', 'standby', 'purchaser', 'standby']);
    expect(rollCustomerType(day4)).toBe('escort');
  });

  it('镖师は 2 菜を注文し、耐心 = 基礎 ×1.3', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const run = makeDayRun(4, ['waiter', 'standby', 'standby', 'purchaser', 'standby']);
    const arrived = advanceDay({ ...run, arrivalTimerMs: 0 }, 16);
    const escort = arrived.customers[0] as CustomerState;
    expect(escort.typeId).toBe('escort');
    expect(escort.extraDishId).not.toBeNull();
    expect(escort.dishesServed).toBe(0);
    expect(escort.maxPatienceMs).toBeCloseTo(
      CUSTOMER.PATIENCE_D4_9_S * CUSTOMER.PATIENCE_FACTOR_ESCORT * MS_PER_SECOND,
      6,
    );
  });

  it('2 菜とも上菜が揃うまで食べない（1 枚目で awaitingDish に差し戻し）', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const run = makeDayRun(4, ['waiter', 'waiter', 'standby', 'purchaser', 'standby']);
    const arrived = advanceDay({ ...run, arrivalTimerMs: 0 }, 16);
    const escort = arrived.customers[0] as CustomerState;
    const withReady = {
      ...arrived,
      kitchen: {
        tickets: [],
        ready: [
          { customerId: escort.id, dishId: escort.dishId },
          { customerId: escort.id, dishId: escort.extraDishId as number },
        ],
      },
    };
    const firstServe = dispatchToServe(withReady, escort.id);
    expect(firstServe.waiterActions).toHaveLength(1);
    // 同一客への同時 2 重派遣は無効（既有ガード）
    expect(dispatchToServe(firstServe, escort.id).waiterActions).toHaveLength(1);
    const afterFirst = settle(firstServe);
    const afterFirstCustomer = afterFirst.customers.find((c) => c.id === escort.id) as CustomerState;
    expect(afterFirstCustomer.dishesServed).toBe(1);
    expect(afterFirstCustomer.stage).toBe('awaitingDish');
    const afterSecond = settle(dispatchToServe(afterFirst, escort.id));
    const eating = afterSecond.customers.find((c) => c.id === escort.id) as CustomerState;
    expect(eating.dishesServed).toBe(2);
    expect(eating.stage).toBe('eating');
  });

  it('離店惩罚は镖师 −3', () => {
    const run = makeDayRun(4, ['waiter', 'standby', 'standby', 'purchaser', 'standby']);
    const escort: CustomerState = {
      id: 1,
      seat: 0,
      dishId: 1,
      typeId: 'escort',
      extraDishId: 2,
      dishesServed: 0,
      stage: 'awaitingDish',
      patienceMs: 1,
      maxPatienceMs: 58_500,
      eatMs: 6_000,
    };
    const left = advanceDay({ ...run, customers: [escort], arrivalTimerMs: 600_000 }, 16);
    expect(left.reputation).toBe(run.reputation - CUSTOMER.LEAVE_REPUTATION_PENALTY_ESCORT);
    expect(left.customers).toHaveLength(0);
  });

  it('離店客の残置菜・製菜中チケットは後厨から掃除される（孤児菜の放置禁止）', () => {
    const run = makeDayRun(4, ['waiter', 'standby', 'standby', 'purchaser', 'standby']);
    const escort: CustomerState = {
      id: 1,
      seat: 0,
      dishId: 1,
      typeId: 'escort',
      extraDishId: 2,
      dishesServed: 0,
      stage: 'awaitingDish',
      patienceMs: 1,
      maxPatienceMs: 58_500,
      eatMs: 6_000,
    };
    const withOrphans = {
      ...run,
      customers: [escort],
      kitchen: {
        tickets: [{ customerId: escort.id, dishId: 2, remainingMs: 5_000 }],
        ready: [{ customerId: escort.id, dishId: 1 }],
      },
      arrivalTimerMs: 600_000,
    };
    const left = advanceDay(withOrphans, 16);
    expect(left.customers).toHaveLength(0);
    expect(left.kitchen.ready).toHaveLength(0);
    expect(left.kitchen.tickets).toHaveLength(0);
  });
});

describe('S-16 老饕（第 7 日起・高级菜・耐心 ×0.8）', () => {
  it('菜种 <4 の日は老饕不生成（散客で代替 — 到達間隔を占有しない）', () => {
    // random: 単一抽選 0.12 = 老饕区間 [w_镖师, w_镖师＋w_老饕) = [0.10, 0.15) 内 → 当選するが菜種不足
    vi.spyOn(Math, 'random').mockReturnValue(0.12);
    const fewKinds = makeDayRun(7, ['waiter', 'standby', 'standby', 'standby', 'standby']);
    expect(availableDishKinds(fewKinds)).toBeLessThan(CUSTOMER.GOURMET_MIN_DISH_KINDS);
    expect(rollCustomerType(fewKinds)).toBe('regular');
  });

  it('第 7 日に抽選で生成され、高级菜（4 号以上）を指定し耐心 = 基礎 ×0.8', () => {
    // random: 単一抽選 0.2 = 老饕区間 [0.15, 0.25) 内。菜号抽選は 0.1 → 高级菜下限
    // GOURMET_DISH_ID_MIN そのもの（=4）になる値。旧実装（1..kinds の全菜号抽選）なら
    // 1+floor(0.1×6)=1 となり本テストは失敗する — 範囲限定を実検出できる mock 値
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.2).mockReturnValue(0.1);
    const run = makeDayRun(10, ['waiter', 'standby', 'standby', 'purchaser', 'purchaser']);
    const arrived = advanceDay({ ...run, arrivalTimerMs: 0 }, 16);
    const gourmet = arrived.customers[0] as CustomerState;
    expect(gourmet.typeId).toBe('gourmet');
    expect(gourmet.dishId).toBeGreaterThanOrEqual(CUSTOMER.GOURMET_DISH_ID_MIN);
    expect(gourmet.extraDishId).toBeNull();
    expect(gourmet.maxPatienceMs).toBeCloseTo(
      CUSTOMER.PATIENCE_D10_15_S * CUSTOMER.PATIENCE_FACTOR_GOURMET * MS_PER_SECOND,
      6,
    );
  });

  it('離店惩罚 −4、服务成功の声望は +2（掌柜自動收钱経路）', () => {
    const base = makeDayRun(10, ['standby', 'standby', 'standby', 'purchaser', 'manager']);
    const gourmet: CustomerState = {
      id: 1,
      seat: 0,
      dishId: 5,
      typeId: 'gourmet',
      extraDishId: null,
      dishesServed: 1,
      stage: 'awaitingPayment',
      patienceMs: 32_000,
      maxPatienceMs: 32_000,
      eatMs: 0,
    };
    const collected = advanceDay(
      { ...base, customers: [gourmet], arrivalTimerMs: 600_000 },
      16,
    );
    expect(collected.reputation).toBe(base.reputation + CUSTOMER.SERVE_SUCCESS_REPUTATION_GOURMET);
    expect(collected.daySummary.served).toBe(1);
    const leaver = advanceDay(
      {
        ...base,
        customers: [{ ...gourmet, stage: 'awaitingDish', patienceMs: 1 }],
        arrivalTimerMs: 600_000,
      },
      16,
    );
    expect(leaver.reputation).toBe(base.reputation - CUSTOMER.LEAVE_REPUTATION_PENALTY_GOURMET);
  });
});

describe('S-16 散客（互換確認）', () => {
  it('散客は 1 菜・離店 −2・服务 +1（S-06 からの後退なし）', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const run = makeDayRun(1, ['standby', 'standby', 'standby', 'purchaser', 'manager']);
    const regular: CustomerState = {
      id: 1,
      seat: 0,
      dishId: 1,
      typeId: 'regular',
      extraDishId: null,
      dishesServed: 1,
      stage: 'awaitingPayment',
      patienceMs: 50_000,
      maxPatienceMs: 50_000,
      eatMs: 0,
    };
    const collected = advanceDay({ ...run, customers: [regular], arrivalTimerMs: 600_000 }, 16);
    expect(collected.reputation).toBe(run.reputation + CUSTOMER.SERVE_SUCCESS_REPUTATION);
    const leaver = advanceDay(
      {
        ...run,
        customers: [{ ...regular, stage: 'awaitingDish', patienceMs: 1 }],
        arrivalTimerMs: 600_000,
      },
      16,
    );
    expect(leaver.reputation).toBe(run.reputation - CUSTOMER.LEAVE_REPUTATION_PENALTY);
  });
});

describe('S-16 单日日间 3 分钟内に読み切れる（快进测试 — 计时不超时）', () => {
  it('第 20 日（最重い阶段）の日间 180s が夜间へ迁移し、客が流れる', () => {
    const run = makeDayRun(20, ['waiter', 'waiter', 'waiter', 'waiter', 'manager']);
    // 「开门营业」直後相当: 到達タイマー = 当日间隔（runEngine.openDoor と同一の初期化）
    let current = { ...run, arrivalTimerMs: 0 };
    const stepMs = 100;
    const totalSteps = (180_000 / stepMs) + 10;
    for (let i = 0; i < totalSteps && current.phase === 'day'; i += 1) {
      // 簡易自動プレイヤー: 点单/上菜/收钱の派遣を毎ステップ試みる
      for (const customer of current.customers) {
        if (customer.stage === 'awaitingOrder') {
          current = dispatchToOrder(current, customer.id);
        } else if (customer.stage === 'awaitingPayment') {
          current = dispatchToCollect(current, customer.id);
        }
      }
      for (const dish of current.kitchen.ready) {
        current = dispatchToServe(current, dish.customerId);
      }
      current = advanceRun(current, stepMs);
    }
    expect(current.phase).toBe('night');
    expect(current.phaseElapsedMs).toBe(0);
    expect(current.daySummary.served).toBeGreaterThan(0);
  });
});
