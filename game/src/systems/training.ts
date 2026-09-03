/**
 * training — 修练成长（gdd「修练成长系统」: 指定属性 +TRAINING_GAIN、3 档成长阶段）。
 * 成长阶段は ui 側が growthStage(total) から導出して台词/差分に使う（architecture §4）。
 * 纯函数・Phaser 非依赖。
 */
import { STAFF } from '../config';
import type { RunState, StaffMember } from '../types';

/** 成长阶段（3 档: 属性合计 0–6 / 7–13 / 14+ — gdd「伙计初始值」表の划分） */
export function growthStage(total: number): 0 | 1 | 2 {
  if (total >= 14) {
    return 2;
  }
  if (total >= 7) {
    return 1;
  }
  return 0;
}

function withTrainedStat(member: StaffMember, value: number): StaffMember {
  switch (member.trainStat) {
    case 'speed':
      return { ...member, speed: value };
    case 'craft':
      return { ...member, craft: value };
    case 'stamina':
      return { ...member, stamina: value };
  }
}

/** 开门营业の瞬間に修练指派分の成長を反映（+TRAINING_GAIN、上限 STAFF_STAT_MAX） */
export function applyTrainingGains(run: RunState): RunState {
  return {
    ...run,
    staff: run.staff.map((member) => {
      if (member.post !== 'training') {
        return member;
      }
      const value = Math.min(STAFF.STAT_MAX, member[member.trainStat] + STAFF.TRAINING_GAIN);
      return withTrainedStat(member, value);
    }),
  };
}
