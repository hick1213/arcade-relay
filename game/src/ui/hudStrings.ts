/**
 * HUD / 暂停面板等的文案 key re-export（S-11）。
 * conventions 规则 4（文案零硬编码）: 显示组件只持有 key，文本经 TextProvider 取得。
 * S-11 落地に伴い key 定数の权威は src/textKeys.ts（systems/i18n の言語表が参照する
 * 共通層）へ移管 — 本文件は ui 側の既存 import 経路を壊さないための re-export のみ。
 * 言語表（中文/英文）は systems/i18n/zhTable.ts・enTable.ts。
 */
export {
  HUD_TEXT_KEYS,
  MENU_TEXT_KEYS,
  RESULT_TEXT_KEYS,
  TITLE_TEXT_KEYS,
} from '../textKeys';
import type { TextProvider } from '../types';
import { translate } from '../systems/i18n';

/** 数值格式化（音量滑块的百分比显示 — conventions 规则 4: 格式化做成函数） */
export const formatVolumePercent = (volume: number): string => `${Math.round(volume * 100)}%`;

/** TextProvider（S-11 以降は systems/i18n の正式查表に委譲 — 缺 key 回落中文＋warn 1 次） */
export const createFallbackTextProvider = (): TextProvider => translate;
