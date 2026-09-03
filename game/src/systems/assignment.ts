/**
 * assignment — 岗位分配（S-05。gdd「岗位分配系统」: 两次点击制の纯逻辑）。
 *
 * - 第 1 点击=岗位图标（selectPost）、第 2 点击=伙计头像（toggleAssignment）。
 * - 已指派伙计の再点击=取消（待命へ）。
 * - 容量约束（config.POST_CAPACITY）超過の指派は拒绝し、noticeKey で提示（acceptance）。
 * - 纯函数・Phaser 非依赖。
 */
import { POST_CAPACITY } from '../config';
import { TEXT_KEYS } from '../textKeys';
import type { PostId, RunState } from '../types';

/** 两次点击制の第 1 步: 岗位图标を選択 */
export function selectPost(run: RunState, post: PostId): RunState {
  return { ...run, selectedPost: post, noticeKey: null };
}

/** 两次点击制の第 2 步: 伙计头像を点击（已指派なら取消、未指派なら selectedPost へ割当） */
export function toggleAssignment(run: RunState, staffId: string): RunState {
  const member = run.staff.find((candidate) => candidate.id === staffId);
  if (member === undefined) {
    return run;
  }
  if (member.post !== 'standby') {
    // 已指派伙计の再点击=取消指派（待命へ）
    return {
      ...run,
      staff: run.staff.map((candidate) =>
        candidate.id === staffId ? { ...candidate, post: 'standby' as const } : candidate,
      ),
      noticeKey: null,
    };
  }
  if (run.selectedPost === null) {
    return { ...run, noticeKey: TEXT_KEYS.MORNING_HINT_SELECT_POST };
  }
  const assigned = run.staff.filter((candidate) => candidate.post === run.selectedPost).length;
  if (assigned >= POST_CAPACITY[run.selectedPost]) {
    // 容量超過の指派は拒绝し提示（acceptance: 超容量的指派被拒绝且有提示）
    return { ...run, noticeKey: TEXT_KEYS.NOTICE_ASSIGN_REJECTED };
  }
  const post: PostId = run.selectedPost;
  return {
    ...run,
    staff: run.staff.map((candidate) =>
      candidate.id === staffId ? { ...candidate, post } : candidate,
    ),
    noticeKey: null,
  };
}
