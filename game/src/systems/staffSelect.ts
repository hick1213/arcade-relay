/**
 * staffSelect — 初始伙计选择（S-22。gdd「解锁」表 UNL-01/02「可替换编成中任意 1 名默认伙计开局」）。
 *
 * - 引擎无关层: 禁止 import Phaser、禁止引用 localStorage。接收值并返回新值（不可变更新）。
 * - 相位: 志向确认（runEngine.confirmAmbition）直后に 'staffSelect' へ进入 →
 *   候補 tap（选择/解除）→ 默认伙计 tap（置換）→ 确认 tap（'morning' へ）。
 * - 候補 = config.UNLOCK_STAFF（UNL-01 柳镖头 / UNL-02 苏御厨。初始值 = gdd「解锁」表のまま）。
 *   未解锁候補は判定区ごと不登録（UI 锁定表示のみ — 選択不能を systems でも二重ガード）。
 * - 置換制約: 各候補は编成内に 1 体のみ・置換先は默认编成（STAFF_ROSTER）のメンバーのみ。
 *   両方解锁時は各 1 名ずつ（最大 2 名）の置換が可能（gdd は候補ごとに「任意 1 名」を規定）。
 */
import { STAFF_ROSTER, UNLOCK_STAFF } from '../config';
import type { RunState, StaffMember, StaffSeed } from '../types';
import type { UnlockId } from './meta/metaTypes';

/** SaveData.unlocks → 'staffSelect' 相位に表示する解锁済み候補 id 一览（未解锁は画面から除外しない — 锁定表示） */
export const unlockedCandidateIds = (
  unlocks: Readonly<Record<UnlockId, boolean>>,
): readonly string[] =>
  UNLOCK_STAFF.filter((seed) => unlocks[seed.unlockId] === true).map((seed) => seed.id);

/** StaffSeed → 编成メンバー（待机・无疲劳。runEngine.createRunForPack の staff 生成と同一規約） */
const toMember = (seed: StaffSeed): StaffMember => ({
  ...seed,
  post: 'standby',
  fatigue: false,
});

/** 志向确认後の run を初始伙计选择相位へ（候補未解锁でも画面は出す — 锁定表示 = acceptance） */
export const beginStaffSelect = (run: RunState, unlockedIds: readonly string[]): RunState => ({
  ...run,
  phase: 'staffSelect',
  staffSelect: {
    unlockedCandidateIds: [...unlockedIds],
    pendingCandidateId: null,
  },
});

/** 候補 tap: 解锁済み候補を選択（再点击で解除。未解锁・锁定中は不発 — 二重ガード） */
export const selectCandidate = (run: RunState, candidateId: string): RunState => {
  const state = run.staffSelect;
  if (run.phase !== 'staffSelect' || state === null) {
    return run;
  }
  if (!state.unlockedCandidateIds.includes(candidateId)) {
    return run;
  }
  const pendingCandidateId = state.pendingCandidateId === candidateId ? null : candidateId;
  return { ...run, staffSelect: { ...state, pendingCandidateId } };
};

/**
 * 置換先 tap: 选择中の候補で默认伙计 1 名を置き換える。
 * 不発条件（全て黙って無視 — 画面が実行可能な操作のみを判定区として登録する前提の防御）:
 * 选择中候補なし / 候補が既に编成内 / 置換先が默认编成（STAFF_ROSTER）外。
 */
export const replaceStaffMember = (run: RunState, staffId: string): RunState => {
  const state = run.staffSelect;
  if (run.phase !== 'staffSelect' || state === null || state.pendingCandidateId === null) {
    return run;
  }
  const candidate = UNLOCK_STAFF.find((seed) => seed.id === state.pendingCandidateId);
  if (candidate === undefined) {
    return run;
  }
  if (run.staff.some((member) => member.id === candidate.id)) {
    return run; // 同一候補の二重置換禁止（gdd「各限 1 名」）
  }
  if (!STAFF_ROSTER.some((seed) => seed.id === staffId)) {
    return run; // 置換先は默认编成のみ（解锁候補同士の入替えは不可）
  }
  return {
    ...run,
    staff: run.staff.map((member) => (member.id === staffId ? toMember(candidate) : member)),
    staffSelect: { ...state, pendingCandidateId: null },
  };
};

/** 选择确定 → 晨间へ（未置換のままでも可 — 默认编成で开局。gdd「重新开始」の开局フロー） */
export const confirmStaffSelect = (run: RunState): RunState => {
  if (run.phase !== 'staffSelect' || run.staffSelect === null) {
    return run;
  }
  return { ...run, phase: 'morning', phaseElapsedMs: 0, staffSelect: null };
};
