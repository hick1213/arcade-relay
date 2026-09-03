/**
 * HUD / 暂停面板的文案 key 表与回落查表（S-10）。
 * conventions 规则 4（文案零硬编码）: 显示组件只持有 key，文本经 TextProvider 取得。
 * S-11（systems/i18n）落地后，GameScene 注入正式的 t() provider，本表即被替换。
 * 代码中不出现内联文案字面量 — 全部集中于此（迁移时仅动本文件与接线 1 行）。
 */
import type { TextProvider } from '../types';

/** 玩家可见文本 key（HUD 与暂停面板） */
export const HUD_TEXT_KEYS = {
  HUD_SILVER: 'hud.silver',
  HUD_REPUTATION: 'hud.reputation',
  HUD_DAY: 'hud.day',
  HUD_LEDGER: 'hud.ledger',
  PAUSE_TITLE: 'pause.title',
  PAUSE_RESUME: 'pause.resume',
  PAUSE_QUIT: 'pause.quit',
} as const;

/** 中文回落表（prototype 阶段的最小查表。S-11 后迁移到 systems/i18n 的语言表） */
const ZH_TABLE: Readonly<Record<string, string>> = {
  [HUD_TEXT_KEYS.HUD_SILVER]: '银子',
  [HUD_TEXT_KEYS.HUD_REPUTATION]: '声望',
  [HUD_TEXT_KEYS.HUD_DAY]: '日数',
  [HUD_TEXT_KEYS.HUD_LEDGER]: '帐本',
  [HUD_TEXT_KEYS.PAUSE_TITLE]: '暂停',
  [HUD_TEXT_KEYS.PAUSE_RESUME]: '继续',
  [HUD_TEXT_KEYS.PAUSE_QUIT]: '回到菜单',
};

/** 缺 key 回落 key 本体（S-11 落地后由 systems/i18n 的 warn-1 次实现接管） */
export const createFallbackTextProvider = (): TextProvider => (key: string) =>
  ZH_TABLE[key] ?? key;
