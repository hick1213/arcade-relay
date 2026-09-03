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

// ==== 元进度存档（gdd「元进度（游戏外）」「存档数据方针」节 — S-13 Menu 显示/设置接线所需）====
// 权威 shape 由 S-14 systems/meta/metaTypes.ts 承接; 迁移函数链+验证在 systems/meta/metaSchema.ts。
// 本定义是 persistence/SaveAdapter 的最小契约，字段名与 gdd 存档表一一对应（禁止结构重复声明 —
// S-14 落地后本节迁移引用 metaTypes，禁止另起第二份定义）。

export type LanguageCode = 'zh' | 'en' | 'ja' | 'ko' | 'th';

export type AchievementId = 'ACH-01' | 'ACH-02' | 'ACH-03' | 'ACH-04' | 'ACH-05' | 'ACH-06';
export type UnlockId = 'UNL-01' | 'UNL-02';

/** 统计（gdd「统计」表） */
export interface MetaStats {
  readonly finished_runs: number;
  readonly silver_peak: number;
  readonly rep_peak: number;
  readonly served_total: number;
}

/** 设置（音量接线到实际音频输出并持久化 — contract §11 Menu 必需要素） */
export interface MetaSettings {
  readonly bgm_volume: number;
  readonly sfx_volume: number;
  readonly lang: LanguageCode;
}

/**
 * 周目续玩快照。gdd: 保存日数/银子/声望/侠点/伙计表/弃牌堆。
 * Menu 仅判定存在性（run !== null → 显示「继续周目」）; 全字段由 runSnapshot story 扩展
 * （追加字段不破坏本契约）。终战败保留、破产/终战胜时置 null（architecture §4）。
 */
export interface RunSnapshot {
  readonly day: number;
  readonly silver: number;
  readonly reputation: number;
  readonly [key: string]: unknown;
}

/** SaveData（localStorage 键 arcaderelay-save、首字段 save_version — contract §6） */
export interface SaveData {
  readonly save_version: number;
  readonly best_score: number;
  readonly stats: MetaStats;
  /** 3 结局（财/侠/名）达成标志 */
  readonly endings_seen: readonly boolean[];
  readonly achievements: Readonly<Record<AchievementId, boolean>>;
  readonly unlocks: Readonly<Record<UnlockId, boolean>>;
  readonly run: RunSnapshot | null;
  readonly settings: MetaSettings;
  /** 仅存档损坏恢复会话中为 true（contract §6 — 传播到 Title/Menu 显示通知） */
  readonly recovered: boolean;
}
