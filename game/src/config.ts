/**
 * 全部游戏参数的权威来源（tech-stack.md 规范 1: 禁止魔法数字）。
 * GDD「数值表」的常量在实现各系统的 story 中按 GDD 记载初始值逐次追加于此。
 * 本文件当前为脚手架阶段的最小集合。
 */

// ==== 画面 ====
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

// ==== 持久化 ====
export const SAVE_KEY = 'arcaderelay-save';
export const SAVE_BACKUP_PREFIX = 'arcaderelay-save.bak.';

// ==== 资产引用（tech-stack.md 规范 5: ASSET_KEYS）====
// design/assets.md 的 IMG-xx / SFX-xx / BGM-xx 资产到位后在此登记。
// 键名 = 资产用途，值 = assets/ 下相对路径（不含扩展名）。
export const ASSET_KEYS = {
  // 背景（IMG-01～03）
  // backgrounds: { ... }
  // 精灵（IMG-04～25）
  // sprites: { ... }
  // 音频（SFX-01～08 / BGM-01～02）
  // audio: { ... }
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
