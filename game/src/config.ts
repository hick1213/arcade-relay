/**
 * 全部游戏参数的权威来源（tech-stack.md 规范 1: 禁止魔法数字）。
 * GDD「数值表」的常量在实现各系统的 story 中按 GDD 记载初始值逐次追加于此。
 * 本文件当前为脚手架阶段的最小集合。
 */
import type { HudState } from './types';

// ==== 画面 ====
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

// ==== 持久化 ====
export const SAVE_KEY = 'arcaderelay-save';
export const SAVE_BACKUP_PREFIX = 'arcaderelay-save.bak.';

// ==== 资产引用（tech-stack.md 规范 5: ASSET_KEYS）====
// design/assets.md 的 IMG-xx / SFX-xx / BGM-xx 资产到位后在此登记。
// 键名 = 资产用途（conventions「命名」: 不使用 IMG-xx 编号），值 = assets/ 下相对路径（不含扩展名）。

// 音频交付格式（design/assets.md「音频」节: OGG Vorbis + M4A/AAC 双格式。BootScene 据此展开 URL、
// Phaser AudioFile 以浏览器 canPlay 自动择一 — Safari 落 M4A、其余落 OGG）
export const AUDIO_FORMATS = ['ogg', 'm4a'] as const;

// SFX-01～08（已生成 — game/assets/MANIFEST.jsonl。变调复用变体由 S-27 以 detune/rate 实现、不新增文件）
export const ASSET_KEYS = {
  audio: {
    sfxUiTap: 'assets/audio/sfx-ui-tap', // SFX-01（菜单确认/通用 UI tap）
    sfxDoorOpen: 'assets/audio/sfx-door-open', // SFX-02
    sfxOrderBubble: 'assets/audio/sfx-order-bubble', // SFX-03
    sfxDishServe: 'assets/audio/sfx-dish-serve', // SFX-04
    sfxCoinCollect: 'assets/audio/sfx-coin-collect', // SFX-05
    sfxFailLeave: 'assets/audio/sfx-fail-leave', // SFX-06
    sfxAbacusLedger: 'assets/audio/sfx-abacus-ledger', // SFX-07
    sfxBattleGong: 'assets/audio/sfx-battle-gong', // SFX-08
  },

  // 背景/精灵（IMG-01～30 未生成 — 保持程序化占位。到位后在此登记并替换 placeholderTextures）

  // BGM-01/02 未生成（design/assets.md「生成实绩」: 留到 Phase 3。到位后在此登记）
  // UI 占位纹理（S-10 ui-engineer。运行时程序化生成 — game/src/ui/placeholderTextures.ts。
  // IMG-xx UI 资产到位后替换为正式资产键即可，显示组件无需改动）
  uiPlaceholder: {
    hudChip: 'ui/hud-chip',
    ledgerButton: 'ui/ledger-button',
    pausePanel: 'ui/pause-panel',
    pauseButton: 'ui/pause-button',
  },
} as const;

// ==== 输入（P-04 纯点击 — S-01。出处: gdd「数值表」「输入」节）====
/** 最小可点击判定区边长（px）。gdd 数值表: 初始 48、调整范围 48–64 */
export const BUTTON_MIN_SIZE_PX = 48;
/** 点击命中优先级。gdd「输入」节: 暂停面板 > 事件卡选项 > 出餐口 > 收钱气泡 > 点单桌 */
export const INPUT_PRIORITY = {
  PAUSE_PANEL: 50,
  EVENT_CARD_OPTION: 40,
  SERVE_WINDOW: 30,
  PAYMENT_BUBBLE: 20,
  TABLE_ORDER: 10,
} as const;

// ==== UI（S-10: HUD 与帐本暂停面板 — ui-engineer。颜色全部取自 design/art-bible.json 调色板）====
export const UI = {
  // 深度（游玩对象默认 0 之上。UI 不覆盖游玩区域中央）
  DEPTH_HUD: 100,
  DEPTH_PAUSE: 200,

  // HUD 布局（画面上缘一排。数值仅从本基准分辨率推导 — Scale.FIT 下不错位）
  HUD_MARGIN: 16,
  HUD_BAR_HEIGHT: 56,
  HUD_CHIP_WIDTH: 172,
  HUD_CHIP_HEIGHT: 44,
  HUD_CHIP_GAP: 12,
  HUD_CHIP_PADDING: 12,

  // HUD 文字（ui-code 规范: 一眼可读的尺寸＋墨色描边与背景分离）
  HUD_FONT_FAMILY: 'sans-serif',
  HUD_LABEL_FONT_SIZE: '15px',
  HUD_VALUE_FONT_SIZE: '22px',
  HUD_TEXT_COLOR: '#F0C182',
  HUD_VALUE_COLOR: '#F0C182',
  HUD_STROKE_COLOR: '#281D10',
  HUD_STROKE_WIDTH: 3,

  // 「帐本」按钮（右上。≥ BUTTON_MIN_SIZE_PX — gdd「输入」节）
  HUD_LEDGER_WIDTH: 64,
  HUD_LEDGER_HEIGHT: 48,
  HUD_LEDGER_FONT_SIZE: '18px',

  // 数值变化的即时反馈（增=金 / 减=朱，调色板 accent 色）
  HUD_FLASH_UP_COLOR: '#C18E52',
  HUD_FLASH_DOWN_COLOR: '#963A16',
  HUD_FLASH_SCALE: 1.18,
  HUD_FLASH_MS: 360,
  HUD_POPUP_OFFSET_Y: 8,
  HUD_POPUP_RISE_PX: 30,
  HUD_POPUP_MS: 720,
  HUD_POPUP_FONT_SIZE: '20px',

  // 暂停面板（画面中央模态）
  PAUSE_PANEL_WIDTH: 420,
  PAUSE_PANEL_HEIGHT: 300,
  PAUSE_TITLE_OFFSET_Y: 44,
  PAUSE_TITLE_FONT_SIZE: '26px',
  PAUSE_BUTTON_WIDTH: 240,
  PAUSE_BUTTON_HEIGHT: 56,
  PAUSE_BUTTON_STACK_OFFSET_Y: 44,
  PAUSE_BUTTON_FONT_SIZE: '20px',

  // 按压反馈（纯点击的单次 pointerdown）
  BUTTON_PRESS_SCALE: 0.94,
  BUTTON_PRESS_MS: 120,

  // 占位面板配色（fill=深棕 / stroke=墨褐 / accent=金 — art-bible 调色板）
  PANEL_FILL: 0x653917,
  PANEL_FILL_ALPHA: 0.94,
  PANEL_STROKE: 0x281d10,
  PANEL_STROKE_WIDTH: 4,
  PANEL_RADIUS: 10,
  PANEL_ACCENT: 0xc18e52,
  PANEL_ACCENT_WIDTH: 2,
  PANEL_ACCENT_INSET: 6,

  // 暂停中的画面变暗遮罩（视觉上传达「已暂停」）
  BLOCKER_COLOR: 0x281d10,
  BLOCKER_ALPHA: 0.55,

  // 输入路由的模态层与判定区 id（S-01 InputRouter。暂停面板 > 其余全部 — conventions 规则 7）
  PAUSE_LAYER_ID: 'pause',
  ZONE_LEDGER: 'ui.ledger',
  ZONE_PAUSE_RESUME: 'ui.pause.resume',
  ZONE_PAUSE_MENU: 'ui.pause.menu',
} as const;

/** HUD 初期表示値（志向确定前的占位。S-04/S-08 接线后由 Systems 层真值置换） */
export const HUD_INITIAL_STATE: HudState = { silver: 0, reputation: 0, day: 1 };
