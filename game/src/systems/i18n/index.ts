/**
 * i18n — 文案查表模块（S-11。conventions 规则 4: 玩家可见文本全部经 key 取得）。
 *
 * - 引擎无关层: Phaser 非依赖、localStorage 不参照（语言值は SaveData.settings.lang —
 *   persistence 层経由で接线层が setLanguage する）。
 * - 缺 key 回落中文表并 console.warn 恰好 1 次（同一 key の重複警告を抑止 —
 *   每フレーム查表でもログが氾濫しない）。中文表にも無い key は key 本体を返す。
 * - setLanguage 即时生效（无需刷新）: provider は毎回現行言語の表を引く。
 *   onLanguageChange で再描画したい接线层に通知する。
 */
import { I18N } from '../../config';
import type { LanguageCode, TextProvider } from '../../types';
import { EN_TABLE } from './enTable';
import { ZH_TABLE } from './zhTable';

/** 言語表レジストリ。未整備言語（ja/ko/th — build S-24）は中文表へ回落 */
const TABLES: Readonly<Partial<Record<LanguageCode, Readonly<Record<string, string>>>>> = {
  zh: ZH_TABLE,
  en: EN_TABLE,
};

let currentLanguage: LanguageCode = I18N.DEFAULT_LANGUAGE;
const warnedKeys = new Set<string>();
const listeners = new Set<(language: LanguageCode) => void>();

export const getLanguage = (): LanguageCode => currentLanguage;

/** 言語を即時切换（provider は以後の查表から新表を引く — 再読み込み不要） */
export const setLanguage = (language: LanguageCode): void => {
  if (language === currentLanguage) {
    return;
  }
  currentLanguage = language;
  for (const listener of listeners) {
    listener(language);
  }
};

/** 言語変更の購読（戻り値 = 解除函数）。接线层の再描画用 */
export const onLanguageChange = (listener: (language: LanguageCode) => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** 同一 key の警告は 1 回のみ（欠落 key の每フレーム查表でログ氾濫しない） */
const warnMissingKeyOnce = (key: string, language: LanguageCode): void => {
  if (warnedKeys.has(key)) {
    return;
  }
  warnedKeys.add(key);
  console.warn(`[i18n] missing key "${key}" in language "${language}" — fell back to zh`);
};

/** 查表本体。现行言語 → 中文表 → key 本体（欠落は console.warn 1 次） */
export const translate = (key: string): string => {
  const localized = TABLES[currentLanguage]?.[key];
  if (localized !== undefined) {
    return localized;
  }
  const zh = ZH_TABLE[key];
  if (zh !== undefined) {
    if (currentLanguage !== 'zh') {
      warnMissingKeyOnce(key, currentLanguage);
    }
    return zh;
  }
  warnMissingKeyOnce(key, currentLanguage);
  return key;
};

/** TextProvider（types.ts の契約）として取得 — scenes/ui へ注入する唯一の入口 */
export const createTextProvider = (): TextProvider => translate;
