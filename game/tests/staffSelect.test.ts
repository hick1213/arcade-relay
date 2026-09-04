/**
 * staffSelect.test.ts — S-22 解锁（UNL-01/02）与初始伙计选择的验收测试（gdd「解锁」表）。
 *
 * - judgeUnlocks: endings_seen 计数 ≥1 → UNL-01 / ≥2 → UNL-02（阈值从 config 取 — 调参不破测试）。
 * - applyRunResult: 置位到 SaveData.unlocks、已解锁不回落（OR 保持）。
 * - 初始伙计选择: 志向确认 → 'staffSelect' 相位、解锁伙计替换任意 1 名默认伙计（初始值 = gdd 表）、
 *   未解锁候補は选择不能、确定（未替换も可）→ 晨间开局。
 *
 * 运行: cd game && npx vitest run tests/staffSelect.test.ts
 */
import { describe, expect, it } from 'vitest';
import { META_SAVE, STAFF_ROSTER, UNLOCK_STAFF } from '../src/config';
import { judgeUnlocks, mergeUnlocks } from '../src/systems/meta/unlocks';
import { applyRunResult, type RunResult } from '../src/systems/meta/metaProgression';
import { createDefaultSaveData } from '../src/systems/meta/metaSchema';
import type { SaveData } from '../src/systems/meta/metaTypes';
import {
  confirmAmbition,
  confirmStaffSelect,
  createInitialRun,
  createResumeRun,
  handleTapEvent,
} from '../src/systems/runEngine';
import { unlockedCandidateIds } from '../src/systems/staffSelect';
import { TAP_EVENTS } from '../src/types';

const runResult = (overrides: Partial<RunResult> = {}): RunResult => ({
  kind: 'runComplete',
  silver: 100,
  reputation: 30,
  staffPower: 10,
  endingBonus: 0,
  ending: null,
  ...overrides,
});

const endingsFor = (count: number, total = META_SAVE.ENDINGS_COUNT): boolean[] =>
  Array.from({ length: total }, (_, index) => index < count);

describe('judgeUnlocks: 解锁判定（gdd「解锁」表）', () => {
  it('endings_seen 计数 0 では両方とも未解锁', () => {
    const judged = judgeUnlocks(endingsFor(0));
    expect(judged['UNL-01']).toBe(false);
    expect(judged['UNL-02']).toBe(false);
  });

  it('计数 ≥1 で UNL-01 のみ解锁', () => {
    const judged = judgeUnlocks(endingsFor(1));
    expect(judged['UNL-01']).toBe(true);
    expect(judged['UNL-02']).toBe(false);
  });

  it('计数 ≥2 で UNL-01/02 とも解锁', () => {
    const judged = judgeUnlocks(endingsFor(2));
    expect(judged['UNL-01']).toBe(true);
    expect(judged['UNL-02']).toBe(true);
  });

  it('阈值は config.META_SAVE.UNLOCK_ENDINGS_REQUIRED と整合する', () => {
    expect(META_SAVE.UNLOCK_ENDINGS_REQUIRED['UNL-01']).toBe(1);
    expect(META_SAVE.UNLOCK_ENDINGS_REQUIRED['UNL-02']).toBe(2);
  });
});

describe('applyRunResult: SaveData.unlocks への置位', () => {
  const apply = (save: SaveData, overrides: Partial<RunResult> = {}): SaveData =>
    applyRunResult(save, runResult(overrides));

  it('初回の结局达成で UNL-01 のみ置位される', () => {
    const saved = apply(createDefaultSaveData(), { ending: 'wealth' });
    expect(saved.unlocks['UNL-01']).toBe(true);
    expect(saved.unlocks['UNL-02']).toBe(false);
  });

  it('2 種類目の结局达成で UNL-02 も置位される', () => {
    let save = createDefaultSaveData();
    save = apply(save, { ending: 'wealth' });
    save = apply(save, { ending: 'xia' });
    expect(save.unlocks['UNL-01']).toBe(true);
    expect(save.unlocks['UNL-02']).toBe(true);
  });

  it('同一结局の重复达成では UNL-02 は立たない', () => {
    let save = createDefaultSaveData();
    save = apply(save, { ending: 'wealth' });
    save = apply(save, { ending: 'wealth' });
    expect(save.unlocks['UNL-01']).toBe(true);
    expect(save.unlocks['UNL-02']).toBe(false);
  });

  it('败局（ending: null）では endings_seen が増えず解锁も進まない', () => {
    let save = createDefaultSaveData();
    save = apply(save, { ending: null });
    expect(save.unlocks['UNL-01']).toBe(false);
    expect(save.unlocks['UNL-02']).toBe(false);
  });

  it('mergeUnlocks: 已解锁は回落しない（OR 保持）', () => {
    const merged = mergeUnlocks({ 'UNL-01': true, 'UNL-02': false }, judgeUnlocks(endingsFor(0)));
    expect(merged['UNL-01']).toBe(true);
    expect(merged['UNL-02']).toBe(false);
  });
});

describe('初始伙计选择（志向确认後の相位）', () => {
  it('解锁なしでは候補は両方とも选择不能（锁定表示のみ）', () => {
    const run = confirmAmbition(createInitialRun(), 'wealth');
    expect(run.phase).toBe('staffSelect');
    expect(run.staffSelect?.unlockedCandidateIds).toEqual([]);
  });

  it('解锁済み候補の id が SaveData.unlocks から导出される', () => {
    const unlocks = { 'UNL-01': true, 'UNL-02': false } as const;
    expect(unlockedCandidateIds(unlocks)).toEqual([UNLOCK_STAFF[0]?.id]);
  });

  it('解锁伙计で默认伙计 1 名を置き換える（初期值 = gdd「解锁」表どおり）', () => {
    const run = confirmAmbition(createInitialRun({ 'UNL-01': true, 'UNL-02': false }), 'xia');
    const candidate = UNLOCK_STAFF[0]!;
    expect(candidate).toBeDefined();
    const target = run.staff[0]!;
    expect(target).toBeDefined();

    let next = handleTapEvent(run, {
      zoneId: 'test',
      event: TAP_EVENTS.STAFF_SELECT_CANDIDATE,
      payload: { candidateId: candidate.id },
      x: 0,
      y: 0,
    });
    expect(next.staffSelect?.pendingCandidateId).toBe(candidate.id);
    next = handleTapEvent(next, {
      zoneId: 'test',
      event: TAP_EVENTS.STAFF_SELECT_REPLACE,
      payload: { staffId: target.id },
      x: 0,
      y: 0,
    });
    const replaced = next.staff.find((member) => member.id === candidate.id);
    expect(replaced).toMatchObject({
      id: candidate.id,
      speed: candidate.speed,
      craft: candidate.craft,
      stamina: candidate.stamina,
      post: 'standby',
      fatigue: false,
    });
    expect(next.staff.find((member) => member.id === target.id)).toBeUndefined();
    expect(next.staff.length).toBe(STAFF_ROSTER.length);
    // 置換の完了で选择中候補は解除される
    expect(next.staffSelect?.pendingCandidateId).toBeNull();
  });

  it('选择制約: 同一候補の二重置換・解锁候補同士の入替えは不発', () => {
    const run = confirmAmbition(createInitialRun({ 'UNL-01': true, 'UNL-02': true }), 'fame');
    const candidate1 = UNLOCK_STAFF[0]!;
    const candidate2 = UNLOCK_STAFF[1]!;
    expect(candidate1).toBeDefined();
    expect(candidate2).toBeDefined();

    // 默认伙计 1 名を candidate1 で置換
    let next = handleTapEvent(run, {
      zoneId: 'test',
      event: TAP_EVENTS.STAFF_SELECT_CANDIDATE,
      payload: { candidateId: candidate1.id },
      x: 0,
      y: 0,
    });
    next = handleTapEvent(next, {
      zoneId: 'test',
      event: TAP_EVENTS.STAFF_SELECT_REPLACE,
      payload: { staffId: run.staff[0]?.id ?? '' },
      x: 0,
      y: 0,
    });
    expect(next.staff.filter((m) => m.id === candidate1.id).length).toBe(1);

    // candidate2 で编成内の candidate1 を置換しようとしても不発
    next = handleTapEvent(next, {
      zoneId: 'test',
      event: TAP_EVENTS.STAFF_SELECT_CANDIDATE,
      payload: { candidateId: candidate2.id },
      x: 0,
      y: 0,
    });
    next = handleTapEvent(next, {
      zoneId: 'test',
      event: TAP_EVENTS.STAFF_SELECT_REPLACE,
      payload: { staffId: candidate1.id },
      x: 0,
      y: 0,
    });
    expect(next.staff.find((m) => m.id === candidate2.id)).toBeUndefined();
    expect(next.staff.length).toBe(STAFF_ROSTER.length);
  });

  it('未解锁候補は選択できない（二重ガード）', () => {
    const run = confirmAmbition(createInitialRun({ 'UNL-01': false, 'UNL-02': false }), 'wealth');
    const lockedCandidate = UNLOCK_STAFF[1]!;
    expect(lockedCandidate).toBeDefined();
    const next = handleTapEvent(run, {
      zoneId: 'test',
      event: TAP_EVENTS.STAFF_SELECT_CANDIDATE,
      payload: { candidateId: lockedCandidate.id },
      x: 0,
      y: 0,
    });
    expect(next.staffSelect?.pendingCandidateId).toBeNull();
  });

  it('确定（未置換も可）で晨间开局。置換は保持される', () => {
    const run = confirmAmbition(createInitialRun({ 'UNL-01': true, 'UNL-02': false }), 'wealth');
    const candidate = UNLOCK_STAFF[0]!;
    expect(candidate).toBeDefined();
    const replaced = handleTapEvent(run, {
      zoneId: 'test',
      event: TAP_EVENTS.STAFF_SELECT_CANDIDATE,
      payload: { candidateId: candidate.id },
      x: 0,
      y: 0,
    });
    const withSwap = handleTapEvent(replaced, {
      zoneId: 'test',
      event: TAP_EVENTS.STAFF_SELECT_REPLACE,
      payload: { staffId: run.staff[2]?.id ?? '' },
      x: 0,
      y: 0,
    });
    const confirmed = confirmStaffSelect(withSwap);
    expect(confirmed.phase).toBe('morning');
    expect(confirmed.staffSelect).toBeNull();
    expect(confirmed.staff.some((m) => m.id === candidate.id)).toBe(true);

    // 未置換のまま确定しても默认编成で开局する
    expect(confirmStaffSelect(run).staff.map((m) => m.id)).toEqual(
      STAFF_ROSTER.map((seed) => seed.id),
    );
  });

  it('继续周目の復帰は初始伙计选择を经由しない（当日晨间）', () => {
    const resumed = createResumeRun({ day: 7, silver: 123, reputation: 45, ambition: 'xia' });
    expect(resumed.phase).toBe('morning');
    expect(resumed.staffSelect).toBeNull();
  });
});
