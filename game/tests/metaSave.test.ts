/**
 * metaSave.test.ts — S-14 元进度持久化的验收测试（tech-stack.md「测试规范」）。
 *
 * - 不使用真实 localStorage: 内存 Storage mock 注入（不触碰真实存档）。
 * - 测试 A: 保存 → 新实例（新 SaveAdapter 调用・同一 storage）重新加载 → 最高分/统计/endings_seen 一致恢复。
 * - 测试 B: 损坏注入（无法解析的数据 / valid JSON 但 schema 不正〔必需字段缺失・类型不正〕/
 *   save_version 缺失 / 未来版本）→ 原始数据备份到 .bak.<epoch> 键、[SaveCorruption] error
 *   恰好 1 次、默认值重建、recovered=true 传播。
 *
 * 运行: cd game && npm test（vitest run）
 */
import { describe, expect, it, vi } from 'vitest';
import { SAVE_BACKUP_PREFIX, SAVE_KEY } from '../src/config';
import { loadSaveData, saveSaveData } from '../src/persistence/SaveAdapter';
import {
  applyRunResult,
  computeRunScore,
  type RunResult,
} from '../src/systems/meta/metaProgression';
import type { SaveData } from '../src/systems/meta/metaTypes';

/** tech-stack「测试规范」的内存 Storage mock（真实 localStorage 不触碰） */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

const runResult = (overrides: Partial<RunResult> = {}): RunResult => ({
  kind: 'runComplete',
  silver: 100,
  reputation: 30,
  staffPower: 10,
  endingBonus: 0,
  ending: null,
  ...overrides,
});

describe('测试 A: 保存 → 新实例重新加载 → 一致恢复', () => {
  it('applyRunResult → persist → 再加载で best_score/统计/endings_seen が一致する', () => {
    const storage = new MemoryStorage();
    const first = loadSaveData(storage);
    expect(first.recovered).toBe(false);

    const updated = applyRunResult(first.data, runResult());
    saveSaveData(updated, storage);

    // 新实例（新しい loadSaveData 呼び出し）が同一 storage から復元する
    const second = loadSaveData(storage);
    expect(second.recovered).toBe(false);
    expect(second.data.best_score).toBe(updated.best_score);
    expect(second.data.stats).toEqual(updated.stats);
    expect(second.data.endings_seen).toEqual(updated.endings_seen);
    expect(second.data.run).toBeNull();
  });

  it('score = floor(silver×0.5 + rep×10 + power×20 + endingBonus) が best_score に入る', () => {
    const storage = new MemoryStorage();
    const result = runResult();
    const expected = Math.floor(
      result.silver * 0.5 + result.reputation * 10 + result.staffPower * 20 + result.endingBonus,
    );
    expect(computeRunScore(result)).toBe(expected);

    const saved = applyRunResult(loadSaveData(storage).data, result);
    saveSaveData(saved, storage);
    expect(loadSaveData(storage).data.best_score).toBe(expected);
  });

  it('best_score は最大値更新（低分の周目で下がらない）・finished_runs が加算される', () => {
    const storage = new MemoryStorage();
    let save = loadSaveData(storage).data;
    save = applyRunResult(save, runResult({ silver: 100, reputation: 30, staffPower: 10 }));
    save = applyRunResult(save, runResult({ silver: 4, reputation: 1, staffPower: 0 }));
    expect(save.stats.finished_runs).toBe(2);
    expect(save.stats.silver_peak).toBe(100);
    expect(save.stats.rep_peak).toBe(30);
    expect(save.stats.served_total).toBe(0);
    saveSaveData(save, storage);
    expect(loadSaveData(storage).data.best_score).toBe(computeRunScore(runResult()));
  });

  it('达成结局时 endings_seen 的对应格置位（config.META_SAVE.ENDING_INDEX 映射）', () => {
    const storage = new MemoryStorage();
    const saved = applyRunResult(loadSaveData(storage).data, runResult({ ending: 'xia' }));
    expect(saved.endings_seen).toEqual([false, true, false]);
  });
});

describe('测试 B: 损坏注入 → .bak 备份 + [SaveCorruption] 1 次 + 默认值重建 + recovered 传播', () => {
  const corruptedCases: ReadonlyArray<{ name: string; raw: string }> = [
    { name: '无法解析的数据（JSON 不正）', raw: '{not-json' },
    {
      name: 'valid JSON 但 schema 不正（必需字段缺失: best_score なし）',
      raw: JSON.stringify({
        save_version: 1,
        stats: { finished_runs: 0, silver_peak: 0, rep_peak: 0, served_total: 0 },
        endings_seen: [false, false, false],
        achievements: {},
        unlocks: {},
        run: null,
        settings: { bgm_volume: 0.7, sfx_volume: 0.8, lang: 'zh' },
        recovered: false,
      }),
    },
    {
      name: 'valid JSON 但类型不正（stats.silver_peak が文字列）',
      raw: JSON.stringify({
        save_version: 1,
        best_score: 0,
        stats: { finished_runs: 0, silver_peak: 'x', rep_peak: 0, served_total: 0 },
        endings_seen: [false, false, false],
        achievements: {},
        unlocks: {},
        run: null,
        settings: { bgm_volume: 0.7, sfx_volume: 0.8, lang: 'zh' },
        recovered: false,
      }),
    },
    {
      name: 'save_version 缺失',
      raw: JSON.stringify({ best_score: 0 }),
    },
    {
      name: '未来版本（隐式降级禁止）',
      raw: JSON.stringify({ save_version: 99, best_score: 0 }),
    },
  ];

  for (const corrupted of corruptedCases) {
    it(`${corrupted.name} → 三件套（.bak + error 1 次 + 默认值 + recovered）`, () => {
      const storage = new MemoryStorage();
      storage.setItem(SAVE_KEY, corrupted.raw);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const loaded = loadSaveData(storage);

      // [SaveCorruption] 前缀的 error 恰好 1 次
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(String(errorSpy.mock.calls[0]?.[0])).toContain('[SaveCorruption]');
      errorSpy.mockRestore();

      // 原始数据备份到 .bak.<epoch> 键（内容 = 损坏数据的原文）
      const backupKeys = Array.from({ length: storage.length }, (_, i) => storage.key(i))
        .filter((key): key is string => key !== null && key.startsWith(SAVE_BACKUP_PREFIX));
      expect(backupKeys).toHaveLength(1);
      expect(storage.getItem(backupKeys[0] as string)).toBe(corrupted.raw);

      // 默认值重建 + recovered 传播（UI 层通知）
      expect(loaded.recovered).toBe(true);
      expect(loaded.data.best_score).toBe(0);
      expect(loaded.data.stats.finished_runs).toBe(0);
      expect(loaded.data.endings_seen).toEqual([false, false, false]);
      expect(loaded.data.run).toBeNull();
    });
  }

  it('键不存在 = 首次启动（非损坏 — error 0 次・recovered=false）', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const loaded = loadSaveData(new MemoryStorage());
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    expect(loaded.recovered).toBe(false);
  });
});

describe('持久化快照规范', () => {
  it('persist 快照の recovered は常に false（会话内标志を次回起動へ持ち越さない）', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, 'broken');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const loaded = loadSaveData(storage);
    errorSpy.mockRestore();
    expect(loaded.recovered).toBe(true);

    saveSaveData(loaded.data, storage);
    const raw: unknown = JSON.parse(storage.getItem(SAVE_KEY) as string);
    expect((raw as SaveData).recovered).toBe(false);
  });
});
