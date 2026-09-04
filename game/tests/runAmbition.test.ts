/**
 * runAmbition.test.ts — S-04 志向系统の验收测试（systems 层纯逻辑）。
 *
 * - 新周目は志向选择（phase='ambition'）から开局する。
 * - 确定後の银子/声望 = GDD 志向别初期值（財 150/15、侠 60/30、名 90/40 — config.AMBITION.START）。
 * - 确定時の run 快照（SaveData.run 契約）と快照からの復帰（当日晨间）。
 *
 * 运行: cd game && npm test（vitest run）
 */
import { describe, expect, it } from 'vitest';
import { AMBITION } from '../src/config';
import {
  confirmAmbition,
  confirmStaffSelect,
  createInitialRun,
  createResumeRun,
  createRunSnapshot,
} from '../src/systems/runEngine';

describe('S-04 志向选择', () => {
  it('新周目は志向选择相位から开局する', () => {
    expect(createInitialRun().phase).toBe('ambition');
  });

  it('財/侠/名それぞれの GDD 初期值で晨间开局する（S-22 から志向确认後は初始伙计选择を挟む）', () => {
    const expectations = {
      wealth: AMBITION.START.wealth,
      xia: AMBITION.START.xia,
      fame: AMBITION.START.fame,
    } as const;
    for (const [id, start] of Object.entries(expectations)) {
      const selected = confirmAmbition(createInitialRun(), id as keyof typeof expectations);
      // S-22: 志向确认直後は初始伙计选择相位（开局资源は確定済み）
      expect(selected.phase).toBe('staffSelect');
      expect(selected.ambition).toBe(id);
      expect(selected.silver).toBe(start.silver);
      expect(selected.reputation).toBe(start.reputation);
      expect(selected.day).toBe(1);
      const run = confirmStaffSelect(selected);
      expect(run.phase).toBe('morning');
      expect(run.ambition).toBe(id);
      expect(run.silver).toBe(start.silver);
      expect(run.reputation).toBe(start.reputation);
      expect(run.day).toBe(1);
    }
  });

  it('確定後の再確定・他相位での確定は無視される（べき等ガード）', () => {
    const selected = confirmAmbition(createInitialRun(), 'xia');
    expect(confirmAmbition(selected, 'fame').ambition).toBe('xia');
  });
});

describe('S-04 run 快照（SaveData.run 契約）', () => {
  it('志向确认直後の run 快照が日数/银子/声望/志向を保持する', () => {
    const run = confirmAmbition(createInitialRun(), 'fame');
    const snapshot = createRunSnapshot(run);
    expect(snapshot).toEqual({
      day: 1,
      silver: AMBITION.START.fame.silver,
      reputation: AMBITION.START.fame.reputation,
      ambition: 'fame',
    });
  });

  it('快照からの復帰は当日晨间で数値が一致する', () => {
    const resumed = createResumeRun({ day: 7, silver: 123, reputation: 45, ambition: 'xia' });
    expect(resumed.phase).toBe('morning');
    expect(resumed.day).toBe(7);
    expect(resumed.silver).toBe(123);
    expect(resumed.reputation).toBe(45);
    expect(resumed.ambition).toBe('xia');
    // 客・订单链・弃牌堆は復帰しない（晨間再排班から再開 — gdd「中断续玩」）
    expect(resumed.customers).toEqual([]);
    expect(resumed.staff.every((member) => member.post === 'standby')).toBe(true);
  });

  it('快照の不正值は既定值へ夹まれる（破損は persistence 层の损坏协议が担当）', () => {
    const resumed = createResumeRun({
      day: -3,
      silver: 'many' as unknown as number,
      reputation: null as unknown as number,
    });
    expect(resumed.day).toBe(1);
    expect(resumed.ambition).toBe(AMBITION.DEFAULT_ID);
  });
});
