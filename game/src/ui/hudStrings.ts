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

/** 玩家可见文本 key（Menu 场景 — S-13 必需要素 4 项） */
export const MENU_TEXT_KEYS = {
  MENU_TITLE: 'menu.title',
  MENU_CONTINUE: 'menu.continue',
  MENU_NEW_RUN: 'menu.newRun',
  MENU_OPEN_STATS: 'menu.openStats',
  MENU_OPEN_SETTINGS: 'menu.openSettings',
  MENU_BACK_TITLE: 'menu.backTitle',
  MENU_RECOVERED_NOTICE: 'menu.recovered',
  MENU_STATS_TITLE: 'menu.stats.title',
  MENU_STATS_BEST: 'menu.stats.best',
  MENU_STATS_RUNS: 'menu.stats.runs',
  MENU_STATS_SILVER_PEAK: 'menu.stats.silverPeak',
  MENU_STATS_REP_PEAK: 'menu.stats.repPeak',
  MENU_STATS_SERVED: 'menu.stats.served',
  MENU_STATS_ENDINGS: 'menu.stats.endings',
  MENU_CLOSE: 'menu.close',
  MENU_SETTINGS_TITLE: 'menu.settings.title',
  MENU_BGM_LABEL: 'menu.settings.bgm',
  MENU_SFX_LABEL: 'menu.settings.sfx',
  MENU_HINT_TITLE: 'menu.settings.hint.title',
  MENU_HINT_BODY: 'menu.settings.hint.body',
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
  [MENU_TEXT_KEYS.MENU_TITLE]: '菜单',
  [MENU_TEXT_KEYS.MENU_CONTINUE]: '继续周目',
  [MENU_TEXT_KEYS.MENU_NEW_RUN]: '新周目',
  [MENU_TEXT_KEYS.MENU_OPEN_STATS]: '图鉴・统计',
  [MENU_TEXT_KEYS.MENU_OPEN_SETTINGS]: '设置',
  [MENU_TEXT_KEYS.MENU_BACK_TITLE]: '返回标题',
  [MENU_TEXT_KEYS.MENU_RECOVERED_NOTICE]: '存档已损坏，本次以初始数据重新开始',
  [MENU_TEXT_KEYS.MENU_STATS_TITLE]: '图鉴・统计',
  [MENU_TEXT_KEYS.MENU_STATS_BEST]: '最高总评分',
  [MENU_TEXT_KEYS.MENU_STATS_RUNS]: '周目数',
  [MENU_TEXT_KEYS.MENU_STATS_SILVER_PEAK]: '银子峰值',
  [MENU_TEXT_KEYS.MENU_STATS_REP_PEAK]: '声望峰值',
  [MENU_TEXT_KEYS.MENU_STATS_SERVED]: '累计服务客数',
  [MENU_TEXT_KEYS.MENU_STATS_ENDINGS]: '结局图鉴',
  [MENU_TEXT_KEYS.MENU_CLOSE]: '关闭',
  [MENU_TEXT_KEYS.MENU_SETTINGS_TITLE]: '设置',
  [MENU_TEXT_KEYS.MENU_BGM_LABEL]: 'BGM 音量',
  [MENU_TEXT_KEYS.MENU_SFX_LABEL]: 'SFX 音量',
  [MENU_TEXT_KEYS.MENU_HINT_TITLE]: '操作说明',
  [MENU_TEXT_KEYS.MENU_HINT_BODY]:
    '全部操作为单击。晨间: 点岗位图标→点伙计头像完成指派，再点「开门营业」。' +
    '日间: 依次点亮点单桌→出餐口→银两气泡接客。夜间: 翻事件卡选一项后点「天明」。' +
    '游玩中点右上「帐本」可随时暂停或回到菜单。',
};

/** 数值格式化（音量滑块的百分比显示 — conventions 规则 4: 格式化做成函数） */
export const formatVolumePercent = (volume: number): string => `${Math.round(volume * 100)}%`;

/** 缺 key 回落 key 本体（S-11 落地后由 systems/i18n 的 warn-1 次实现接管） */
export const createFallbackTextProvider = (): TextProvider => (key: string) =>
  ZH_TABLE[key] ?? key;
