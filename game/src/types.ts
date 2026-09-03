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
  /** 暂停面板「回到菜单」 */
  PAUSE_TO_MENU: 'onPauseToMenuTap',
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
