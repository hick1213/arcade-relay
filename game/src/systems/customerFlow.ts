/**
 * customerFlow — 日间接客核心循环（S-06/S-07。gdd「客人流与订单系统」）。
 *
 * - 客人到達（阶段间隔常量）→入座→点单气泡→点击派空闲跑堂点单→后厨制菜→出餐口→
 *   点击派跑堂上菜→吃完→银两气泡→点击收钱（有掌柜时自动）。
 * - 收入 = round(菜价 ×(1＋剩余耐心比例 ×TIP_FACTOR))。耐心归零=离店・声望 −2。
 * - 伙计の移动・动作は全部 delta 驱动（remainingMs 累计）且同一伙计は同時に 1 动作。
 * - 立绘は占位色块（S-06 acceptance）。
 * - 纯函数・Phaser 非依赖（画面座標は config.GAME_LAYOUT の定数のみ参照）。
 */
import {
  CUSTOMER,
  GAME_LAYOUT,
  MS_PER_SECOND,
  SERVICE,
  STAFF,
} from '../config';
import type {
  CustomerState,
  Point,
  RunState,
  StaffMember,
  WaiterAction,
  WaiterActionKind,
} from '../types';
import { applyDeltas } from './economy';
import {
  advanceKitchen,
  availableDishKinds,
  dishPrice,
  headChefCraft,
  purchaserCount,
  startPrep,
  takeReadyDish,
} from './kitchen';

// ==== 阶段常量（gdd「难度曲线」表の段階別定数 — 插值なしで一一对应）====

export function intervalSecondsForDay(day: number): number {
  if (day <= 3) {
    return CUSTOMER.INTERVAL_D1_3_S;
  }
  if (day <= 9) {
    return CUSTOMER.INTERVAL_D4_9_S;
  }
  if (day <= 15) {
    return CUSTOMER.INTERVAL_D10_15_S;
  }
  return CUSTOMER.INTERVAL_D16_20_S;
}

export function basePatienceSecondsForDay(day: number): number {
  if (day <= 3) {
    return CUSTOMER.PATIENCE_D1_3_S;
  }
  if (day <= 9) {
    return CUSTOMER.PATIENCE_D4_9_S;
  }
  if (day <= 15) {
    return CUSTOMER.PATIENCE_D10_15_S;
  }
  return CUSTOMER.PATIENCE_D16_20_S;
}

// ==== 耗时算式（S-07: 速度属性の可见差分 + gdd「三属性的日间效果」の体力/疲劳）====

/** 动作耗时 ×(1 − SPEED_FACTOR×速度)、疲劳时 ×体力减免后の倍率 */
function actionDurationMs(baseSeconds: number, member: StaffMember): number {
  const speedFactor = Math.max(STAFF.ACTION_FACTOR_MIN, 1 - STAFF.SPEED_FACTOR * member.speed);
  const fatigueFactor = member.fatigue
    ? 1 + (STAFF.FATIGUE_PENALTY - 1) * (1 - STAFF.STAMINA_RESIST * member.stamina)
    : 1;
  return baseSeconds * speedFactor * fatigueFactor * MS_PER_SECOND;
}

function moveDurationMs(from: Point, to: Point): number {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  return (distance / STAFF.MOVE_SPEED_PX_PER_S) * MS_PER_SECOND;
}

function seatPoint(seat: number): Point {
  // seat は常に CUSTOMER.SEATS 未満（systems が生成を保証 — 配列固定長）
  return GAME_LAYOUT.TABLES[seat] as Point;
}

// ==== 状态取得ヘルパ ====

function isWaitingStage(customer: CustomerState): boolean {
  return customer.stage === 'awaitingOrder' || customer.stage === 'awaitingDish';
}

function isServingAction(kind: WaiterActionKind): boolean {
  return kind === 'moveToOrder' || kind === 'takingOrder';
}

function isServeAction(kind: WaiterActionKind): boolean {
  return kind === 'moveToWindow' || kind === 'serving';
}

function isCollectAction(kind: WaiterActionKind): boolean {
  return kind === 'moveToCollect' || kind === 'collecting';
}

/** 空闲跑堂（post=waiter 且现行动作なし — 同一伙计は同時に 1 单） */
function idleWaiter(run: RunState): StaffMember | undefined {
  const busy = new Set(run.waiterActions.map((action) => action.staffId));
  return run.staff.find((member) => member.post === 'waiter' && !busy.has(member.id));
}

function staffOf(run: RunState, staffId: string): StaffMember | undefined {
  return run.staff.find((member) => member.id === staffId);
}

/** 现行动作の出発点（动集中なら対象桌、无ければ柜台） */
function actionOrigin(run: RunState, staffId: string): Point {
  const ongoing = run.waiterActions.find((action) => action.staffId === staffId);
  if (ongoing !== undefined) {
    return seatPoint(ongoing.seat);
  }
  return GAME_LAYOUT.COUNTER;
}

// ==== 日间 1 フレームの推进 ====

/** 日间全体の推进（runEngine から呼ばれる唯一の入口） */
export function advanceDay(run: RunState, deltaMs: number): RunState {
  let next = tickPatience(run, deltaMs);
  next = tryArrival(next, deltaMs);
  next = tickEating(next, deltaMs);
  next = autoCollectWithManager(next);
  next = { ...next, kitchen: advanceKitchen(next.kitchen, deltaMs) };
  next = advanceWaiterActions(next, deltaMs);
  return next;
}

/** 耐心倒计时（待ちステージのみ進む）。归零で离店・声望 −2（S-06 acceptance） */
function tickPatience(run: RunState, deltaMs: number): RunState {
  let reputationDelta = 0;
  let failed = 0;
  const customers: CustomerState[] = [];
  for (const customer of run.customers) {
    if (!isWaitingStage(customer)) {
      customers.push(customer);
      continue;
    }
    const patienceMs = customer.patienceMs - deltaMs;
    if (patienceMs > 0) {
      customers.push({ ...customer, patienceMs });
      continue;
    }
    reputationDelta -= CUSTOMER.LEAVE_REPUTATION_PENALTY;
    failed += 1;
  }
  return {
    ...run,
    customers,
    reputation: run.reputation + reputationDelta,
    daySummary: {
      ...run.daySummary,
      reputationNet: run.daySummary.reputationNet + reputationDelta,
      failed: run.daySummary.failed + failed,
    },
  };
}

/** 到达计时（delta 累计）。空席があれば散客を入座させる */
function tryArrival(run: RunState, deltaMs: number): RunState {
  if (run.customers.length >= CUSTOMER.SEATS) {
    return { ...run, arrivalTimerMs: 0 };
  }
  const arrivalTimerMs = run.arrivalTimerMs - deltaMs;
  if (arrivalTimerMs > 0) {
    return { ...run, arrivalTimerMs };
  }
  const seat = firstFreeSeat(run.customers);
  if (seat === null) {
    return { ...run, arrivalTimerMs: 0 };
  }
  const kindCount = availableDishKinds(run);
  const dishId = 1 + Math.floor(Math.random() * kindCount);
  const patiencePenaltyS =
    purchaserCount(run) === 0 ? CUSTOMER.NO_PURCHASE_PATIENCE_PENALTY_S : 0;
  const maxPatienceMs = (basePatienceSecondsForDay(run.day) - patiencePenaltyS) * MS_PER_SECOND;
  const customer: CustomerState = {
    id: run.customerSeq + 1,
    seat,
    dishId,
    stage: 'awaitingOrder',
    patienceMs: maxPatienceMs,
    maxPatienceMs,
    eatMs: CUSTOMER.EAT_S * MS_PER_SECOND,
  };
  return {
    ...run,
    customers: [...run.customers, customer],
    customerSeq: customer.id,
    arrivalTimerMs: intervalSecondsForDay(run.day) * MS_PER_SECOND,
  };
}

function firstFreeSeat(customers: readonly CustomerState[]): number | null {
  const taken = new Set(customers.map((customer) => customer.seat));
  for (let seat = 0; seat < CUSTOMER.SEATS; seat += 1) {
    if (!taken.has(seat)) {
      return seat;
    }
  }
  return null;
}

/** 吃饭计时 → 银两气泡（awaitingPayment）へ */
function tickEating(run: RunState, deltaMs: number): RunState {
  const customers = run.customers.map((customer) => {
    if (customer.stage !== 'eating') {
      return customer;
    }
    const eatMs = customer.eatMs - deltaMs;
    return eatMs > 0
      ? { ...customer, eatMs }
      : { ...customer, stage: 'awaitingPayment' as const, eatMs: 0 };
  });
  return { ...run, customers };
}

/** 有掌柜时收钱自动（gdd「输入」表: 无掌柜时需手动） */
function autoCollectWithManager(run: RunState): RunState {
  if (!run.staff.some((member) => member.post === 'manager')) {
    return run;
  }
  const payable = run.customers.filter(
    (customer) =>
      customer.stage === 'awaitingPayment' &&
      !run.waiterActions.some((action) => action.customerId === customer.id),
  );
  return payable.reduce((state, customer) => collectCustomer(state, customer), run);
}

/** 收钱: 收入 = round(菜价 ×(1＋剩余耐心比例 ×TIP_FACTOR))、声望 +1（S-06 acceptance） */
function collectCustomer(run: RunState, customer: CustomerState): RunState {
  const patienceRatio = Math.max(0, customer.patienceMs) / customer.maxPatienceMs;
  const income = Math.round(dishPrice(customer.dishId) * (1 + patienceRatio * CUSTOMER.TIP_FACTOR));
  const withDeltas = applyDeltas(run, income, CUSTOMER.SERVE_SUCCESS_REPUTATION);
  return {
    ...withDeltas,
    customers: withDeltas.customers.filter((candidate) => candidate.id !== customer.id),
    daySummary: {
      ...withDeltas.daySummary,
      income: withDeltas.daySummary.income + income,
      reputationNet: withDeltas.daySummary.reputationNet + CUSTOMER.SERVE_SUCCESS_REPUTATION,
      served: withDeltas.daySummary.served + 1,
    },
  };
}

// ==== 点击派遣（runEngine から语义化 tap を受けて跑堂を派遣）====

/** 点击点单气泡的桌 → 派空闲跑堂前往点单 */
export function dispatchToOrder(run: RunState, customerId: number): RunState {
  if (run.phase !== 'day') {
    return run;
  }
  const customer = run.customers.find(
    (candidate) => candidate.id === customerId && candidate.stage === 'awaitingOrder',
  );
  if (
    customer === undefined ||
    run.waiterActions.some((action) => action.customerId === customerId && isServingAction(action.kind))
  ) {
    return run; // 同一桌重复点击无效（gdd「输入」表）
  }
  const waiter = idleWaiter(run);
  if (waiter === undefined) {
    return run;
  }
  return beginAction(run, waiter, 'moveToOrder', customer, seatPoint(customer.seat));
}

/** 点击出餐口亮起的菜 → 派空闲跑堂上菜 */
export function dispatchToServe(run: RunState, customerId: number): RunState {
  if (run.phase !== 'day') {
    return run;
  }
  const dish = run.kitchen.ready.find((candidate) => candidate.customerId === customerId);
  const customer = run.customers.find((candidate) => candidate.id === customerId);
  if (
    dish === undefined ||
    customer === undefined ||
    run.waiterActions.some((action) => action.customerId === customerId && isServeAction(action.kind))
  ) {
    return run;
  }
  const waiter = idleWaiter(run);
  if (waiter === undefined) {
    return run;
  }
  return beginAction(run, waiter, 'moveToWindow', customer, GAME_LAYOUT.SERVE_WINDOW);
}

/** 点击银两气泡的桌 → 派空闲跑堂收钱（无掌柜时） */
export function dispatchToCollect(run: RunState, customerId: number): RunState {
  if (run.phase !== 'day') {
    return run;
  }
  const customer = run.customers.find(
    (candidate) => candidate.id === customerId && candidate.stage === 'awaitingPayment',
  );
  if (
    customer === undefined ||
    run.waiterActions.some((action) => action.customerId === customerId && isCollectAction(action.kind))
  ) {
    return run;
  }
  const waiter = idleWaiter(run);
  if (waiter === undefined) {
    return run;
  }
  return beginAction(run, waiter, 'moveToCollect', customer, seatPoint(customer.seat));
}

function beginAction(
  run: RunState,
  waiter: StaffMember,
  kind: WaiterActionKind,
  customer: CustomerState,
  target: Point,
): RunState {
  const from = actionOrigin(run, waiter.id);
  const totalMs = moveDurationMs(from, target);
  const action: WaiterAction = {
    staffId: waiter.id,
    kind,
    customerId: customer.id,
    seat: customer.seat,
    remainingMs: totalMs,
    totalMs,
  };
  return { ...run, waiterActions: [...run.waiterActions, action] };
}

// ==== 跑堂动作の推进（移动完了→动作→完了で效果発動）====

export function advanceWaiterActions(run: RunState, deltaMs: number): RunState {
  let next = run;
  for (const action of run.waiterActions) {
    next = stepAction(next, action, deltaMs);
  }
  return next;
}

function stepAction(run: RunState, action: WaiterAction, deltaMs: number): RunState {
  if (!run.waiterActions.some((candidate) => candidate.staffId === action.staffId)) {
    return run; // 已完了/除去（客人离店等で先行 step が処理济み）
  }
  const remainingMs = action.remainingMs - deltaMs;
  if (remainingMs > 0) {
    return {
      ...run,
      waiterActions: run.waiterActions.map((candidate) =>
        candidate.staffId === action.staffId ? { ...action, remainingMs } : candidate,
      ),
    };
  }
  return completeAction(run, action);
}

function completeAction(run: RunState, action: WaiterAction): RunState {
  const withoutAction = {
    ...run,
    waiterActions: run.waiterActions.filter((candidate) => candidate.staffId !== action.staffId),
  };
  const customer = withoutAction.customers.find((candidate) => candidate.id === action.customerId);
  if (customer === undefined) {
    return withoutAction; // 客人は既に离店 — 动作を免除して跑堂を解放
  }
  const waiter = staffOf(withoutAction, action.staffId);
  if (waiter === undefined) {
    return withoutAction;
  }
  switch (action.kind) {
    case 'moveToOrder':
      return followUp(
        withoutAction,
        action,
        'takingOrder',
        customer,
        waiter,
        SERVICE.ORDER_TAKE_S,
        'ordering',
      );
    case 'takingOrder': {
      // 点单完了 → 后厨へ制菜依頼（掌勺手艺で短缩）、客人は等菜へ
      const withPrep = {
        ...withoutAction,
        kitchen: startPrep(
          withoutAction.kitchen,
          customer.id,
          customer.dishId,
          headChefCraft(withoutAction),
        ),
      };
      return setStage(withPrep, customer.id, 'awaitingDish');
    }
    case 'moveToWindow':
      return followUp(withoutAction, action, 'serving', customer, waiter, SERVICE.SERVE_S, 'serving');
    case 'serving': {
      // 上菜完了 → 出餐口から引き取り、客人は食べる
      const withTaken = {
        ...withoutAction,
        kitchen: takeReadyDish(withoutAction.kitchen, customer.id),
      };
      return setStage(withTaken, customer.id, 'eating');
    }
    case 'moveToCollect':
      return followUp(
        withoutAction,
        action,
        'collecting',
        customer,
        waiter,
        SERVICE.COLLECT_S,
        'collecting',
      );
    case 'collecting':
      return collectCustomer(withoutAction, customer);
  }
}

function followUp(
  run: RunState,
  action: WaiterAction,
  kind: WaiterActionKind,
  customer: CustomerState,
  waiter: StaffMember,
  baseSeconds: number,
  stage: CustomerState['stage'],
): RunState {
  const totalMs = actionDurationMs(baseSeconds, waiter);
  const nextAction: WaiterAction = {
    ...action,
    kind,
    remainingMs: totalMs,
    totalMs,
  };
  return {
    ...run,
    waiterActions: [...run.waiterActions, nextAction],
    customers: run.customers.map((candidate) =>
      candidate.id === customer.id ? { ...candidate, stage } : candidate,
    ),
  };
}

function setStage(
  run: RunState,
  customerId: number,
  stage: CustomerState['stage'],
): RunState {
  return {
    ...run,
    customers: run.customers.map((candidate) =>
      candidate.id === customerId ? { ...candidate, stage } : candidate,
    ),
  };
}
