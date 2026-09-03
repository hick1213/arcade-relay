/**
 * 共享类型（跨 systems / scenes / ui / persistence 使用）。
 * 引擎无关类型优先定义于此；Phaser 相关类型仅允许在 scenes/ ui/ 中引用。
 */

// ==== 点击输入（S-01: 点击输入抽象化模块。出处: gdd「输入」节）====

/**
 * 语义化点击事件名（gdd「输入」表的动作一一对应）。
 * 全部为单次 pointerdown 触发 — 无 pointerup / 双击 / 长按 / 拖拽依赖（conventions 规则 2）。
 */
export const TAP_EVENTS = {
  /** 志向选择（S-04: 財/侠/名 3 按钮。payload.ambitionId） */
  AMBITION_CONFIRM: 'onAmbitionConfirmTap',
  /** 晨间「开门营业」 */
  OPEN_DOOR: 'onOpenDoorTap',
  /** 晨间岗位图标（两次点击制的第一步） */
  ASSIGN_SLOT: 'onAssignSlotTap',
  /** 晨间伙计头像（两次点击制的第二步 / 已指派再点=取消） */
  STAFF: 'onStaffTap',
  /** 日间亮起点单气泡的空桌 → 派跑堂点单 */
  TABLE_ORDER: 'onTableTap',
  /** 日间出餐口亮起的菜 → 派跑堂上菜 */
  SERVE_WINDOW: 'onServeWindowTap',
  /** 日间吃完亮起银两气泡的桌 → 收钱 */
  PAYMENT_BUBBLE: 'onPaymentTap',
  /** 夜间「翻卡」 */
  EVENT_CARD_DRAW: 'onEventCardDrawTap',
  /** 夜间事件卡选项 */
  EVENT_CARD_OPTION: 'onEventCardOptionTap',
  /** 夜间反馈后的「天明」（第 20 日夜为「迎战」） */
  DAYBREAK: 'onDaybreakTap',
  /** 终战「开战」 */
  FIGHT_CONFIRM: 'onFightConfirmTap',
  /** 终战「雇镖师援助」 */
  AID_HIRE: 'onAidHireTap',
  /** 右上「帐本」按钮 → 打开暂停面板 */
  LEDGER_BUTTON: 'onLedgerTap',
  /** 暂停面板「继续」 */
  PAUSE_RESUME: 'onPauseResumeTap',
  /** 暂停面板「结束周目」（prototype 临时経路 — S-03/S-08 接线后由破产/终战判定置換） */
  PAUSE_END_RUN: 'onPauseEndRunTap',
  /** 暂停面板「回到菜单」 */
  PAUSE_TO_MENU: 'onPauseToMenuTap',
  // ==== Result 场景（S-15: 场景循环闭合）====
  /** 「再来一周目」→ GameScene 志向选择（不继承任何周目内状态 — gdd「重新开始」） */
  RESULT_RETRY: 'onResultRetryTap',
  /** 「回到菜单」→ MenuScene */
  RESULT_TO_MENU: 'onResultToMenuTap',
  // ==== Menu 场景（S-13: Menu 必需要素）====
  /** 「继续周目」（run 快照存在时显示）→ GameScene 恢复 */
  MENU_CONTINUE: 'onMenuContinueTap',
  /** 「新周目」→ GameScene 志向选择 */
  MENU_NEW_RUN: 'onMenuNewRunTap',
  /** 「图鉴・统计」→ 游戏外显示面板展开 */
  MENU_OPEN_STATS: 'onMenuOpenStatsTap',
  /** 「设置」→ 设置面板展开 */
  MENU_OPEN_SETTINGS: 'onMenuOpenSettingsTap',
  /** 「返回标题」→ TitleScene（退出入口） */
  MENU_BACK_TITLE: 'onMenuBackTitleTap',
  /** 面板「关闭」 */
  MENU_CLOSE_PANEL: 'onMenuClosePanelTap',
  /** BGM 音量滑块（点击轨道位置即设定 — P-04 单击） */
  MENU_BGM_VOLUME: 'onMenuBgmVolumeTap',
  /** SFX 音量滑块 */
  MENU_SFX_VOLUME: 'onMenuSfxVolumeTap',
  /** 语言切换（S-11: zh/en 即时切换 — 点击即切换并持久化） */
  MENU_LANGUAGE_TOGGLE: 'onMenuLanguageToggleTap',
} as const;

export type TapEventName = (typeof TAP_EVENTS)[keyof typeof TAP_EVENTS];

/** 矩形范围（画面坐标 px。scenes/ui 层使用 Phaser 坐标，本类型本身引擎无关） */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** 可点击判定区（scenes/ui 层注册。priority 使用 config.ts 的 INPUT_PRIORITY） */
export interface TapZone {
  readonly id: string;
  readonly bounds: Rect;
  readonly priority: number;
  readonly event: TapEventName;
  readonly payload?: Readonly<Record<string, number | string>>;
  /** 归属层（如暂停面板 'pause'）。blockingLayer 指定期间仅同层判定区响应 */
  readonly layer?: string;
}

/** 命中并派发的点击结果 */
export interface TapHit {
  readonly zoneId: string;
  readonly event: TapEventName;
  readonly payload: Readonly<Record<string, number | string>>;
  /** pointer 坐标（音量滑块等位置感知判定区用。InputRouter 的 pointerdown 直通传入） */
  readonly x: number;
  readonly y: number;
}

export type TapEventHandler = (hit: TapHit) => void;

// ==== HUD（S-10: HUD 与帐本暂停面板 — ui-engineer）====

/**
 * HUD 显示状态。真值在 Systems 层（economy / dayCycle）;
 * UI 仅接收此状态绘制，禁止在 UI 侧持有独立计数器（双重管理禁止）。
 */
export interface HudState {
  readonly silver: number;
  readonly reputation: number;
  readonly day: number;
}

/**
 * 文案查表 provider（conventions 规则 4: 文案零硬编码 — 玩家可见文本全部经 key 取得）。
 * S-11 systems/i18n 落地后由其 t() 实现（缺 key 回落中文）。
 */
export type TextProvider = (key: string) => string;

// ==== 周目终结摘要（S-15: Game→Result 迁移载荷。真值由 Systems 层生成 — UI 仅接收绘制，
// 禁止在 UI 侧持有/累加。字段对应 gdd「总评分」公式的输入项）====

/** 周目终结种类（破产败局 / 终战败 / 周目完成 — gdd「胜负条件」） */
export type RunEndKind = 'bankruptcy' | 'finalBattleLoss' | 'runComplete';

export interface RunEndSummary {
  readonly kind: RunEndKind;
  /** 周目终值银子（silverEnd） */
  readonly silver: number;
  /** 周目终值声望（repEnd） */
  readonly reputation: number;
  /** 全伙计三属性合计（staffPowerTotal） */
  readonly staffPower: number;
  /** 结局加成（财/侠/名结局 = 200 — S-20 结局判定接线前为占位 0） */
  readonly endingBonus: number;
  /**
   * 达成结局（财/侠/名。runComplete 时由 S-20 结局判定填入 — 败局/接线前は省略）。
   * S-25 Result 结局演出: 显示侧は省略时に汎用タイトルへ回落（插画/结局文も非表示）。
   */
  readonly ending?: AmbitionId | null;
  /**
   * persist 直前の best_score（S-25 新纪录标记の判定基準。GameScene.goToResult が
   * applyRunResult 適用前に取得して付与 — finalBattleLoss は persist 不発のため未更新値）。
   */
  readonly bestScoreBefore?: number;
}

// ==== 元进度存档（gdd「元进度（游戏外）」「存档数据方针」节）====
// 权威 shape = systems/meta/metaTypes.ts（S-14 落地）。本文件仅 re-export —
// 禁止另起第二份定义（迁移函数链+验证在 systems/meta/metaSchema.ts、I/O 在 persistence/）。

export type {
  AchievementId,
  LanguageCode,
  MetaSettings,
  MetaStats,
  RunSnapshot,
  SaveData,
  UnlockId,
} from './systems/meta/metaTypes';

// ==== 周目内玩法状态（S-02/S-03/S-05/S-06/S-08/S-09 — systems 纯逻辑 ⇔ ui/GameplayView 显示）====
// 真值は Systems 层（runEngine）。UI はこの状态を受けて描くだけ（双重管理禁止 — ui-code 规范）。

/**
 * 一日相位（gdd「一日相位控制器」: 晨→日→夜の场景内状态机）。
 * 'ambition' = 新周目开局の志向选择（S-04）。确认后晨间へ迁移し、以後は gdd の 3 相位循环。
 */
export type Phase = 'ambition' | 'morning' | 'day' | 'night';

/** 岗位（gdd「岗位分配系统」: 跑堂/掌柜/采购/修练 ＋ 待命） */
export type PostId = 'waiter' | 'manager' | 'purchaser' | 'training';
export type StaffPost = PostId | 'standby';
export type TrainStat = 'speed' | 'craft' | 'stamina';

/** 志向（gdd「志向系统」: 财/侠/名） */
export type AmbitionId = 'wealth' | 'xia' | 'fame';

/** 画面坐标点（px。数值は config.GAME_LAYOUT の权威値 — 本类型は引擎无关） */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** 伙计初期种子（config.STAFF_ROSTER の要素。gdd「伙计初始值」表） */
export interface StaffSeed {
  readonly id: string;
  readonly nameKey: string;
  readonly speed: number;
  readonly craft: number;
  readonly stamina: number;
  /** 修练で伸びる指定属性（各伙计の得意属性 — 実装判断は config.ts に注记） */
  readonly trainStat: TrainStat;
}

export interface StaffMember {
  readonly id: string;
  readonly nameKey: string;
  readonly speed: number;
  readonly craft: number;
  readonly stamina: number;
  readonly trainStat: TrainStat;
  readonly post: StaffPost;
  readonly fatigue: boolean;
}

/** 客人の订单链ステージ（到达→点单→等菜→上菜→吃→收钱 — gdd「客人流与订单系统」） */
export type CustomerStage =
  | 'awaitingOrder'
  | 'ordering'
  | 'awaitingDish'
  | 'serving'
  | 'eating'
  | 'awaitingPayment'
  | 'collecting';

export interface CustomerState {
  readonly id: number;
  readonly seat: number;
  readonly dishId: number;
  readonly stage: CustomerStage;
  readonly patienceMs: number;
  readonly maxPatienceMs: number;
  readonly eatMs: number;
}

/** 跑堂の单一动作（移动→动作の 2 段。同一伙计は同時に 1 动作 — S-06 acceptance） */
export type WaiterActionKind =
  | 'moveToOrder'
  | 'takingOrder'
  | 'moveToWindow'
  | 'serving'
  | 'moveToCollect'
  | 'collecting';

export interface WaiterAction {
  readonly staffId: string;
  readonly kind: WaiterActionKind;
  readonly customerId: number;
  readonly seat: number;
  readonly remainingMs: number;
  readonly totalMs: number;
}

export interface KitchenTicket {
  readonly customerId: number;
  readonly dishId: number;
  readonly remainingMs: number;
}

export interface ReadyDish {
  readonly customerId: number;
  readonly dishId: number;
}

export interface KitchenState {
  readonly tickets: readonly KitchenTicket[];
  readonly ready: readonly ReadyDish[];
}

/** 单日成绩摘要（gdd「单日成绩摘要」: 夜结算で表示、只展示不另计分） */
export interface DaySummary {
  readonly income: number;
  readonly reputationNet: number;
  readonly served: number;
  readonly failed: number;
  readonly wage: number;
}

export type NightStage = 'summary' | 'card' | 'result';

export interface DrawnEventCard {
  readonly cardId: number;
  readonly chosenIndex: number | null;
  readonly resultTextKey: string | null;
}

/** 事件卡数据表要素（数据表=systems/eventCardData.ts、逻辑=systems/eventCard.ts — S-09） */
export interface EventCardOptionData {
  readonly textKey: string;
  readonly resultTextKey: string;
  readonly silverDelta: number;
  readonly reputationDelta: number;
  readonly xiaDelta: number;
  /** 适配志向（この志向开局时、正の Δ に AMBITION_BIAS 偏移 — gdd「事件卡系统」） */
  readonly favoredAmbition: AmbitionId | null;
}

export interface EventCardData {
  readonly id: number;
  readonly titleKey: string;
  readonly options: readonly EventCardOptionData[];
}

/** 周目内全体状态（runEngine の单一持有。不可变更新 — conventions「类型设计」） */
export interface RunState {
  readonly day: number;
  readonly phase: Phase;
  readonly phaseElapsedMs: number;
  readonly silver: number;
  readonly reputation: number;
  readonly xiaPoints: number;
  readonly ambition: AmbitionId;
  readonly staff: readonly StaffMember[];
  readonly customers: readonly CustomerState[];
  readonly kitchen: KitchenState;
  readonly waiterActions: readonly WaiterAction[];
  readonly arrivalTimerMs: number;
  readonly selectedPost: PostId | null;
  /** 直前の操作に対する提示（容量拒绝等。i18n key — systems は文案を知らない） */
  readonly noticeKey: string | null;
  readonly daySummary: DaySummary;
  readonly nightStage: NightStage;
  readonly drawnCard: DrawnEventCard | null;
  readonly discardedCardIds: readonly number[];
  readonly customerSeq: number;
  readonly finalBattleNight: boolean;
  readonly ended: RunEndSummary | null;
}
