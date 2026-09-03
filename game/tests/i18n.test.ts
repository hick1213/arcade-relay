/**
 * i18n.test.ts — S-11 i18n 基础（中文全量 + 缺 key 兜底）的验收测试。
 *
 * - 缺 key 回落中文并 console.warn 恰好 1 次（同 key の重複警告なし）。
 * - zh/en 2 表骨架: 言語切替が setLanguage 即時に反映（再読み込み不要）。
 * - 中文表にも無い key は key 本体を返す（最終回落）。
 *
 * 运行: cd game && npm test（vitest run）
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLanguage, translate } from '../src/systems/i18n';
import { TEXT_KEYS } from '../src/textKeys';

afterEach(() => {
  // 他テストへの言語漏出を防ぐ（各テストで既定 zh に戻す）
  setLanguage('zh');
});

describe('S-11 i18n — 缺 key 兜底', () => {
  it('中文表の key は中文文案を返す（warn なし）', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(translate(TEXT_KEYS.BUTTON_OPEN_DOOR)).toBe('开门营业');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('en 選択時に en 表のみの key は英文を返す', () => {
    setLanguage('en');
    expect(translate(TEXT_KEYS.BUTTON_OPEN_DOOR)).toBe('Open Doors');
  });

  it('現行言語表に無い key は中文へ回落し console.warn 恰好 1 次', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // ja は未整備言語（表なし）— 全 key が中文回落の該当例
    setLanguage('ja');
    // 1 回目: 回落中文 + warn 1 次
    expect(translate(TEXT_KEYS.BUTTON_OPEN_DOOR)).toBe('开门营业');
    expect(warn).toHaveBeenCalledTimes(1);
    // 2 回目以降: 同 key の警告は増えない（毎フレーム查表でも氾濫しない）
    expect(translate(TEXT_KEYS.BUTTON_OPEN_DOOR)).toBe('开门营业');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('どの言語表にも無い key は key 本体を返す（warn 1 次）', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const unknown = 'totally.unknown.key';
    expect(translate(unknown)).toBe(unknown);
    expect(translate(unknown)).toBe(unknown);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe('S-11 i18n — 言語切替の即時反映', () => {
  it('setLanguage 直後の查表から新しい言語の文案を返す（再読み込み不要）', () => {
    expect(translate(TEXT_KEYS.BUTTON_OPEN_DOOR)).toBe('开门营业');
    setLanguage('en');
    expect(translate(TEXT_KEYS.BUTTON_OPEN_DOOR)).toBe('Open Doors');
    setLanguage('zh');
    expect(translate(TEXT_KEYS.BUTTON_OPEN_DOOR)).toBe('开门营业');
  });

  it('未整備言語（ja — build S-24 で整備）は中文へ回落する', () => {
    setLanguage('ja');
    expect(translate(TEXT_KEYS.BUTTON_OPEN_DOOR)).toBe('开门营业');
  });
});
