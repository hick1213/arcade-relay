/**
 * dayCycle — 一日相位控制器（S-03。gdd「一日相位控制器」: 晨→日→夜の纯状态机）。
 *
 * - 晨间「开门营业」→日间、夜间「天明」→次日晨间。相位迁移は全部プレイヤー操作で起きる。
 * - 日间 DAY_SERVICE_DURATION_S は唯一の硬计时（delta 累计 — conventions 规则 3）。
 * - 晨间/夜间は无强制时限（晨间超 MORNING_GUIDE_TARGET_S は「开门营业」按钮脉冲のみ —
 *   脉冲判定は表示侧が phaseElapsedMs から導出）。
 * - 纯函数（入力値→戻り値の不可变更新 — conventions「类型设计」）。Phaser 非依赖。
 */
import { DAY_CYCLE, MS_PER_SECOND } from '../config';
import type { RunState } from '../types';

/** 第 20 日夜か（gdd: 第 20 日夜触发终战事件） */
export function isFinalBattleNight(day: number): boolean {
  return day === DAY_CYCLE.FINAL_BATTLE_DAY;
}

/** 晨间「开门营业」→ 日间（排班未完成でも开门可 — S-05 acceptance） */
export function openDoor(run: RunState): RunState {
  if (run.phase !== 'morning') {
    return run;
  }
  return { ...run, phase: 'day', phaseElapsedMs: 0 };
}

/** 日间 delta 累计。唯一硬计时に达したら夜间へ（残客は日終了で清算なしに退場 — 実装判断） */
export function advanceDayPhase(run: RunState, deltaMs: number): RunState {
  if (run.phase !== 'day') {
    return run;
  }
  const phaseElapsedMs = run.phaseElapsedMs + deltaMs;
  if (phaseElapsedMs < DAY_CYCLE.DAY_SERVICE_DURATION_S * MS_PER_SECOND) {
    return { ...run, phaseElapsedMs };
  }
  return {
    ...run,
    phase: 'night',
    phaseElapsedMs: 0,
    nightStage: 'summary',
    customers: [],
    waiterActions: [],
  };
}

/** 夜间「天明」→ 翌日晨间（日数 +1。日内状态全リセット、岗位表は朝の再排班用に全員待機へ） */
export function daybreak(run: RunState): RunState {
  return {
    ...run,
    day: run.day + 1,
    phase: 'morning',
    phaseElapsedMs: 0,
    customers: [],
    waiterActions: [],
    kitchen: { tickets: [], ready: [] },
    arrivalTimerMs: 0,
    selectedPost: null,
    noticeKey: null,
    daySummary: { income: 0, reputationNet: 0, served: 0, failed: 0, wage: 0 },
    nightStage: 'summary',
    drawnCard: null,
    // 疲劳は「次日生效」（S-18）: 当夜の事件卡適用分（nightFatigueIds）のみ翌日に残り、
    // 前日から持ち越りの疲劳はここで回復する
    staff: run.staff.map((member) => ({
      ...member,
      post: 'standby' as const,
      fatigue: run.nightFatigueIds.includes(member.id),
    })),
    nightFatigueIds: [],
    finalBattleNight: isFinalBattleNight(run.day + 1),
  };
}
