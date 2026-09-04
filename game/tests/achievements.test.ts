/**
 * achievements.test.ts — S-21 成就判定（ACH-01～06）的验收测试（gdd「成就」表）。
 *
 * - 纯 reducer 测试（不触碰 localStorage — applyRunResult 直接传入 SaveData）。
 * - ACH-01～03: 结局对应置位 / 败局不判定。
 * - ACH-04: 3 结局图鉴完成（最后一格点亮的周目成立）。
 * - ACH-05: 单周目声望 ≥ config.META_SAVE.ACH05_REPUTATION（阈值从 config 取 — 调参不破测试）。
 * - ACH-06: 单属性 ≥ config.STAFF.STAT_MAX。
 * - 已达成不重复触发・不回落（后续周目 OR 保持）。
 * - diffAchievements: 只返回新达成的 id（达成反馈源的契约）。
 *
 * 运行: cd game && npx vitest run tests/achievements.test.ts
 */
import { describe, expect, it } from 'vitest';
import { META_SAVE, STAFF } from '../src/config';
import {
  diffAchievements,
  judgeAchievements,
  mergeAchievements,
} from '../src/systems/meta/achievements';
import { applyRunResult, type RunResult } from '../src/systems/meta/metaProgression';
import { createDefaultSaveData } from '../src/systems/meta/metaSchema';
import type { SaveData } from '../src/systems/meta/metaTypes';

const runResult = (overrides: Partial<RunResult> = {}): RunResult => ({
  kind: 'runComplete',
  silver: 100,
  reputation: 30,
  staffPower: 10,
  endingBonus: 0,
  ending: null,
  ...overrides,
});

const apply = (save: SaveData, overrides: Partial<RunResult> = {}): SaveData =>
  applyRunResult(save, runResult(overrides));

describe('ACH-01～03: 结局对应置位', () => {
  it('财/侠/名结局がそれぞれ ACH-01/02/03 を置位する', () => {
    expect(apply(createDefaultSaveData(), { ending: 'wealth' }).achievements['ACH-01']).toBe(true);
    expect(apply(createDefaultSaveData(), { ending: 'xia' }).achievements['ACH-02']).toBe(true);
    expect(apply(createDefaultSaveData(), { ending: 'fame' }).achievements['ACH-03']).toBe(true);
  });

  it('结局判定を行わない败局（ending: null）は ACH-01～03 不発', () => {
    const saved = apply(createDefaultSaveData(), { ending: null });
    expect(saved.achievements['ACH-01']).toBe(false);
    expect(saved.achievements['ACH-02']).toBe(false);
    expect(saved.achievements['ACH-03']).toBe(false);
    expect(saved.achievements['ACH-04']).toBe(false);
  });
});

describe('ACH-04: 全结局图鉴完成', () => {
  it('3 结局を達成した周目で ACH-04 が成立する', () => {
    let save = createDefaultSaveData();
    save = apply(save, { ending: 'wealth' });
    expect(save.achievements['ACH-04']).toBe(false);
    save = apply(save, { ending: 'xia' });
    expect(save.achievements['ACH-04']).toBe(false);
    save = apply(save, { ending: 'fame' });
    expect(save.achievements['ACH-04']).toBe(true);
  });
});

describe('ACH-05: 单周目声望阈值', () => {
  it(`声望 ≥ ${META_SAVE.ACH05_REPUTATION} で成立・未满は不発（结局不依存）`, () => {
    const reached = apply(createDefaultSaveData(), { reputation: META_SAVE.ACH05_REPUTATION });
    expect(reached.achievements['ACH-05']).toBe(true);
    const below = apply(createDefaultSaveData(), { reputation: META_SAVE.ACH05_REPUTATION - 1 });
    expect(below.achievements['ACH-05']).toBe(false);
  });

  it('败局（ending: null）でも声望达标なら成立', () => {
    const saved = apply(createDefaultSaveData(), {
      ending: null,
      reputation: META_SAVE.ACH05_REPUTATION,
    });
    expect(saved.achievements['ACH-05']).toBe(true);
  });
});

describe('ACH-06: 单属性修练至上限', () => {
  it(`单属性 ≥ STAFF.STAT_MAX(${STAFF.STAT_MAX}) で成立・未满は不発`, () => {
    const reached = apply(createDefaultSaveData(), { maxStaffStat: STAFF.STAT_MAX });
    expect(reached.achievements['ACH-06']).toBe(true);
    const below = apply(createDefaultSaveData(), { maxStaffStat: STAFF.STAT_MAX - 1 });
    expect(below.achievements['ACH-06']).toBe(false);
  });

  it('maxStaffStat 省略（旧 caller/占位 summary）は ACH-06 不発', () => {
    const { maxStaffStat: _omit, ...withoutStat } = runResult();
    const saved = applyRunResult(createDefaultSaveData(), withoutStat);
    expect(saved.achievements['ACH-06']).toBe(false);
  });
});

describe('已达成不重复触发・不回落', () => {
  it('一度达成的成就は后续周目で保持される（OR 合成）', () => {
    let save = apply(createDefaultSaveData(), { ending: 'xia' });
    expect(save.achievements['ACH-02']).toBe(true);
    save = apply(save, { ending: 'wealth', reputation: 1 });
    expect(save.achievements['ACH-02']).toBe(true);
    expect(save.achievements['ACH-01']).toBe(true);
    expect(save.endings_seen).toEqual([true, true, false]);
  });
});

describe('纯函数契约', () => {
  it('judgeAchievements は结局/阈值を判定する', () => {
    const judged = judgeAchievements(
      { ending: 'fame', reputation: META_SAVE.ACH05_REPUTATION, maxStaffStat: STAFF.STAT_MAX },
      [false, false, true],
    );
    expect(judged['ACH-03']).toBe(true);
    expect(judged['ACH-04']).toBe(false);
    expect(judged['ACH-05']).toBe(true);
    expect(judged['ACH-06']).toBe(true);
  });

  it('mergeAchievements は既达成を保持し judge 侧の新达成を取り込む', () => {
    const before = createDefaultSaveData().achievements;
    const merged = mergeAchievements(before, { ...before, 'ACH-05': true });
    expect(merged['ACH-05']).toBe(true);
    expect(merged['ACH-01']).toBe(false);
  });

  it('diffAchievements は新达成のみ返す（达成反馈源）', () => {
    const before = createDefaultSaveData().achievements;
    const after = { ...before, 'ACH-02': true, 'ACH-06': true };
    expect(diffAchievements(before, after)).toEqual(['ACH-02', 'ACH-06']);
    expect(diffAchievements(after, after)).toEqual([]);
  });
});
