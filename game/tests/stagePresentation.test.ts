/**
 * stagePresentation.test.ts — S-28 成长差分表示写像（ui/stagePresentation — 纯函数）の验证。
 *
 * - gdd「伙计初始值」差分表 → 表示パラメータ（台词/色调/bob/残影/ぐらつき）の写像。
 * - 未登记 id のフォールバック（汎用台词/汎用 tint）。
 * - 掌勺導出（headChefStaff — systems/kitchen.headChefCraft と同値照合）と
 *   黑烟/金光の伙计条件ゲート（铁牛本人のみ — CR-CODE iter1 finding 1）。
 *
 * 运行: cd game && npm test -- stagePresentation
 */
import { describe, expect, it } from 'vitest';
import { GAMEPLAY, STAGE_FX } from '../src/config';
import {
  headChefFx,
  headChefStaff,
  staffStageLineKey,
  staffStagePresentation,
  staffStageTint,
} from '../src/ui/stagePresentation';
import type { RunState, StaffMember, StaffPost } from '../src/types';
import { confirmAmbition, createInitialRun } from '../src/systems/runEngine';

function member(
  id: string,
  speed: number,
  craft: number,
  stamina: number,
  post: StaffPost = 'standby',
): StaffMember {
  return {
    id,
    nameKey: `staff.name.${id}`,
    speed,
    craft,
    stamina,
    trainStat: 'craft',
    post,
    fatigue: false,
  };
}

function runWithStaff(staff: readonly StaffMember[]): RunState {
  return { ...confirmAmbition(createInitialRun(), 'xia'), staff };
}

describe('S-28 台词写像（staffStageLineKey）', () => {
  it('登记済み伙计は阶段ごとに異なる台词 key を返す', () => {
    const keys = [0, 1, 2].map((stage) => staffStageLineKey('afu', stage as 0 | 1 | 2));
    expect(new Set(keys).size).toBe(3);
  });

  it('未登记 id は汎用阶段台词にフォールバックする', () => {
    // 未登记 id どうしは同一の汎用 key（フォールバック表を共有）
    expect(staffStageLineKey('unlock-hero', 1)).toBe(staffStageLineKey('unlock-other', 1));
    // かつ登记済み伙计の個別 key とは異なる
    expect(staffStageLineKey('unlock-hero', 2)).not.toBe(staffStageLineKey('afu', 2));
    expect(staffStageLineKey('unlock-hero', 1)).not.toBe(staffStageLineKey('xiaodie', 1));
  });
});

describe('S-28 色调写像（staffStageTint）', () => {
  it('登记済み伙计は伙计別 ramp、未登记 id は汎用 ramp にフォールバックする', () => {
    const tieniuRamp = STAGE_FX.TINTS_BY_STAFF.tieniu as readonly [number, number, number];
    expect(staffStageTint('tieniu', 0)).toBe(tieniuRamp[0]);
    expect(staffStageTint('unlock-hero', 1)).toBe(GAMEPLAY.STAGE_TINTS[1]);
  });
});

describe('S-28 移動演出写像（staffStagePresentation）', () => {
  it('bob 振幅/周波数は阶段で単調に増える（目視できる速度差）', () => {
    for (const stage of [0, 1, 2] as const) {
      const p = staffStagePresentation('wenqu', stage);
      expect(p.bobAmpPx).toBe(STAGE_FX.BOB_AMP_PX[stage]);
      expect(p.bobFreqHz).toBe(STAGE_FX.BOB_FREQ_HZ[stage]);
    }
    expect(STAGE_FX.BOB_AMP_PX[0]).toBeLessThan(STAGE_FX.BOB_AMP_PX[2]);
    expect(STAGE_FX.BOB_FREQ_HZ[0]).toBeLessThan(STAGE_FX.BOB_FREQ_HZ[2]);
  });

  it('残影は阿福の高阶のみ、ぐらつきは小蝶の低位のみ（gdd 差分表）', () => {
    expect(staffStagePresentation('afu', 2).trail).toBe(true);
    expect(staffStagePresentation('afu', 1).trail).toBe(false);
    expect(staffStagePresentation('tieniu', 2).trail).toBe(false);
    expect(staffStagePresentation('xiaodie', 0).waddleRad).toBeGreaterThan(0);
    expect(staffStagePresentation('xiaodie', 2).waddleRad).toBe(0);
    expect(staffStagePresentation('afu', 0).waddleRad).toBe(0);
  });
});

describe('S-28 掌勺導出（headChefStaff — kitchen.headChefCraft と同値照合）', () => {
  it('岗位≠修练で手艺最高の伙计を返す（修练中は除外）', () => {
    const run = runWithStaff([
      member('afu', 3, 1, 2, 'waiter'),
      member('tieniu', 1, 3, 2, 'manager'),
      member('wenqu', 2, 9, 1, 'training'),
    ]);
    expect(headChefStaff(run)?.id).toBe('tieniu');
  });

  it('手艺が同值のときは最初のメンバー（reduce-max と同順）を採用する', () => {
    const run = runWithStaff([
      member('xiaodie', 2, 3, 3, 'waiter'),
      member('tieniu', 1, 3, 2, 'manager'),
    ]);
    expect(headChefStaff(run)?.id).toBe('xiaodie');
  });

  it('全員が修练中（掌勺不在）は null を返す', () => {
    const run = runWithStaff([member('afu', 3, 9, 2, 'training')]);
    expect(headChefStaff(run)).toBeNull();
  });
});

describe('S-28 黑烟/金光ゲート（headChefFx — 铁牛本人のみ）', () => {
  it('铁牛が掌勺の低位（初期值 合计 6）→ 黑烟のみ', () => {
    const run = runWithStaff([member('tieniu', 1, 3, 2, 'manager'), member('afu', 3, 1, 2, 'waiter')]);
    expect(headChefFx(run)).toEqual({ smoke: true, glow: false });
  });

  it('铁牛が掌勺の高阶（合计 14+）→ 金光のみ', () => {
    const run = runWithStaff([member('tieniu', 5, 7, 3, 'manager')]);
    expect(headChefFx(run)).toEqual({ smoke: false, glow: true });
  });

  it('铁牛以外が最高手艺のときは黑烟も金光も出さない（CR-CODE iter1 finding 1）', () => {
    const run = runWithStaff([member('afu', 3, 9, 2, 'waiter'), member('tieniu', 1, 3, 2, 'manager')]);
    expect(headChefFx(run)).toEqual({ smoke: false, glow: false });
  });

  it('掌勺不在なら両方 off', () => {
    const run = runWithStaff([member('tieniu', 1, 3, 2, 'training')]);
    expect(headChefFx(run)).toEqual({ smoke: false, glow: false });
  });
});
