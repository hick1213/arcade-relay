/**
 * runEngine — 周目内状態の组合根（S-03/S-05/S-06/S-08/S-09 の systems を唯一の入口に束ねる）。
 * GameScene は本モジュールの createInitialRun / advanceRun / handleTapEvent だけを呼ぶ
 * （Scene 轻薄 — tech-stack 规范 3）。状态は不可变更新、纯逻辑のみ（Phaser 非依赖）。
 */
import { AMBITION, DAY_CYCLE, MS_PER_SECOND, STAFF_ROSTER } from '../config';
import type {
  AmbitionId,
  FinalBattleSnapshot,
  PostId,
  RunState,
  RunSnapshot,
  TapHit,
} from '../types';
import { TAP_EVENTS } from '../types';
import { getAmbitionPack, isAmbitionId, type AmbitionPack } from './ambition';
import { selectPost, toggleAssignment } from './assignment';
import { applyTrainingGains } from './training';
import * as dayCycle from './dayCycle';
import * as economy from './economy';
import * as customerFlow from './customerFlow';
import { chooseOption, drawCard } from './eventCard';
import { createBattleState, enterBattle, fight, hireAid } from './finalBattle';
import { intervalSecondsForDay } from './customerFlow';
import {
  beginStaffSelect,
  confirmStaffSelect,
  replaceStaffMember,
  selectCandidate,
  unlockedCandidateIds,
} from './staffSelect';
import type { UnlockId } from './meta/metaTypes';

// 初始伙计选择（S-22）の确定入口は Scene/tests からも runEngine 経由で呼ぶ
//（Systems への入口を runEngine に集約 — GameScene 薄薄規約の接線方針と同じ）
export { confirmStaffSelect } from './staffSelect';

/** 志向确定后的晨间开局状態（S-04: 银子/声望 = GDD 志向别初始值） */
function createRunForPack(pack: AmbitionPack): RunState {
  return {
    day: 1,
    phase: 'morning',
    phaseElapsedMs: 0,
    silver: pack.silverStart,
    reputation: pack.reputationStart,
    xiaPoints: 0,
    ambition: pack.id,
    // 初始伙计选择状态（S-22。'staffSelect' 相位のみ非 null — 晨间以降・復帰後は null）
    staffSelect: null,
    staff: STAFF_ROSTER.map((seed) => ({ ...seed, post: 'standby' as const, fatigue: false })),
    customers: [],
    kitchen: { tickets: [], ready: [] },
    waiterActions: [],
    arrivalTimerMs: 0,
    selectedPost: null,
    noticeKey: null,
    daySummary: { income: 0, reputationNet: 0, served: 0, failed: 0, wage: 0 },
    nightStage: 'summary',
    drawnCard: null,
    discardedCardIds: [],
    nightFatigueIds: [],
    customerSeq: 0,
    finalBattleNight: false,
    finalBattle: null,
    ended: null,
  };
}

/**
 * 新周目の初期状態 = 志向选择（S-04）。財/侠/名が確定するまでの仮リソースは
 * DEFAULT_ID（config.AMBITION.DEFAULT_ID — Systems 層の破綻がないための安全夹）で埋める。
 * unlocks（S-22）: SaveData.unlocks を渡すと解锁済み候補が初始伙计选择に出る
 * （省略时 = 全未解锁 — 锁定表示のみ。テスト等の互換用既定值）。
 */
export function createInitialRun(
  unlocks: Readonly<Record<UnlockId, boolean>> = createDefaultUnlocks(),
): RunState {
  const base = createRunForPack(getAmbitionPack(AMBITION.DEFAULT_ID));
  // staffSelect は 'ambition' 相位中も解锁済み候補 id の搬运役として非 null
  // （confirmAmbition が参照 → 'staffSelect' 相位へ引き継ぐ。pendingCandidateId は未使用）
  return {
    ...base,
    phase: 'ambition',
    staffSelect: {
      unlockedCandidateIds: unlockedCandidateIds(unlocks),
      pendingCandidateId: null,
    },
  };
}

/** 全 false の unlocks（createInitialRun 既定值。metaSchema.createDefaultSaveData と同形） */
function createDefaultUnlocks(): Record<UnlockId, boolean> {
  return { 'UNL-01': false, 'UNL-02': false };
}

/**
 * 志向确认（S-04 acceptance）: 選択志向の GDD 初期值で初始伙计选择（S-22）へ。
 * 确认ボタンで 'morning' へ抜ける（confirmStaffSelect）まで开局资源は確定済みだが
 * 编成は置換可能 — gdd「解锁」表「可替换编成中任意 1 名默认伙计开局」。
 */
export function confirmAmbition(run: RunState, ambitionId: AmbitionId): RunState {
  if (run.phase !== 'ambition') {
    return run;
  }
  const unlockedIds = run.staffSelect?.unlockedCandidateIds ?? [];
  return beginStaffSelect(createRunForPack(getAmbitionPack(ambitionId)), unlockedIds);
}

/**
 * 志向确定時の run 快照（S-04 acceptance「志向确认时 run 快照写入 SaveData」）。
 * 字段は metaTypes.RunSnapshot 契约（日数/银子/声望＋志向。build S-23 で拡張）。
 */
export function createRunSnapshot(run: RunState): RunSnapshot {
  return {
    day: run.day,
    silver: run.silver,
    reputation: run.reputation,
    ambition: run.ambition,
  };
}

/**
 * run 快照からの復帰（Menu「继续周目」— S-04 快照書き込みの読み出し側）。
 * 恢复先は当日晨间（未排班・客無し — gdd「中断续玩」。全状态は build S-23 で拡張）。
 * 快照值が不正な場合は既定値へ夹む（破損扱いは persistence 层の损坏协议が担当）。
 */
export function createResumeRun(snapshot: RunSnapshot): RunState {
  const day = typeof snapshot.day === 'number' && snapshot.day >= 1 ? Math.floor(snapshot.day) : 1;
  const silver = typeof snapshot.silver === 'number' ? snapshot.silver : 0;
  const reputation = typeof snapshot.reputation === 'number' ? snapshot.reputation : 0;
  const ambition = isAmbitionId(snapshot.ambition) ? snapshot.ambition : AMBITION.DEFAULT_ID;
  const resumed = createRunForPack(getAmbitionPack(ambition));
  return {
    ...resumed,
    day,
    silver,
    reputation,
    finalBattleNight: dayCycle.isFinalBattleNight(day),
  };
}

/** 1 フレームの推进（delta 驱动 — conventions 规则 3）。夜入りの结算と破产判定を含む */
export function advanceRun(run: RunState, deltaMs: number): RunState {
  let next = dayCycle.advanceDayPhase(run, deltaMs);
  if (next.phase === 'day') {
    next = customerFlow.advanceDay(next, deltaMs);
  }
  if (run.phase === 'day' && next.phase === 'night') {
    next = economy.chargeNightWage(next); // 夜间结算: 当日工钱扣除（S-08 acceptance）
  }
  return checkBankruptcy(next);
}

/** 语义化 tap → 各 systems へDispatch（優先度仲裁は InputRouter 済み — conventions 规则 7） */
export function handleTapEvent(run: RunState, hit: TapHit): RunState {
  let next = dispatchTap(run, hit);
  return checkBankruptcy(next);
}

function dispatchTap(run: RunState, hit: TapHit): RunState {
  switch (hit.event) {
    case TAP_EVENTS.AMBITION_CONFIRM:
      return confirmAmbition(run, String(hit.payload.ambitionId) as AmbitionId);
    // ==== 初始伙计选择（S-22）====
    case TAP_EVENTS.STAFF_SELECT_CANDIDATE:
      return selectCandidate(run, String(hit.payload.candidateId));
    case TAP_EVENTS.STAFF_SELECT_REPLACE:
      return replaceStaffMember(run, String(hit.payload.staffId));
    case TAP_EVENTS.STAFF_SELECT_CONFIRM:
      return confirmStaffSelect(run);
    case TAP_EVENTS.ASSIGN_SLOT:
      return selectPost(run, String(hit.payload.postId) as PostId);
    case TAP_EVENTS.STAFF:
      return toggleAssignment(run, String(hit.payload.staffId));
    case TAP_EVENTS.OPEN_DOOR:
      return openDoor(run);
    case TAP_EVENTS.TABLE_ORDER:
      return customerFlow.dispatchToOrder(run, Number(hit.payload.customerId));
    case TAP_EVENTS.SERVE_WINDOW:
      return customerFlow.dispatchToServe(run, Number(hit.payload.customerId));
    case TAP_EVENTS.PAYMENT_BUBBLE:
      return customerFlow.dispatchToCollect(run, Number(hit.payload.customerId));
    case TAP_EVENTS.EVENT_CARD_DRAW:
      return drawCard(run);
    case TAP_EVENTS.EVENT_CARD_OPTION:
      return chooseOption(run, Number(hit.payload.optionIndex));
    case TAP_EVENTS.DAYBREAK:
      return daybreakTap(run);
    case TAP_EVENTS.FIGHT_CONFIRM:
      return fightFinalBattle(run);
    case TAP_EVENTS.AID_HIRE:
      return hireFinalBattleAid(run);
    default:
      return run;
  }
}

/** 开门营业: 修练成长の反映（S-05）→ 日间へ、到達タイマーを当日间隔にセット */
function openDoor(run: RunState): RunState {
  if (run.phase !== 'morning') {
    return run;
  }
  const opened = applyTrainingGains(dayCycle.openDoor(run));
  return {
    ...opened,
    arrivalTimerMs: intervalSecondsForDay(opened.day) * MS_PER_SECOND,
  };
}

/**
 * 夜间「天明」→ 翌日晨间。第 20 日夜は「迎战」→ 终战開戦前選択へ（S-19。
 * gdd「一日相位控制器」: 第 20 日夜触发终战事件。開戦前快照は finalBattle.preSnapshot に
 * 生成 — 终战败「重试当日」の恢复源）。prototype の暫定 runComplete 経路は置換。
 */
function daybreakTap(run: RunState): RunState {
  if (run.phase !== 'night' || run.nightStage !== 'result') {
    return run; // 结果反馈を読み終えるまで推进しない（S-09 acceptance）
  }
  if (run.finalBattleNight) {
    return enterBattle(run);
  }
  return dayCycle.daybreak(run);
}

/** 终战「开战」（S-19。prelude 以外／终战状態なしは不発） */
function fightFinalBattle(run: RunState): RunState {
  if (run.finalBattle === null || run.nightStage !== 'battle') {
    return run;
  }
  return fight(run);
}

/** 终战「雇镖师援助」（S-19。银子不足/雇入济みは finalBattle.hireAid 内で不発） */
function hireFinalBattleAid(run: RunState): RunState {
  if (run.finalBattle === null || run.nightStage !== 'battle') {
    return run;
  }
  return hireAid(run);
}

/** 破产判定（夜结算後と收钱/事件 Δ 後に成立 — S-08 acceptance） */
function checkBankruptcy(run: RunState): RunState {
  if (run.ended !== null || !economy.isBankrupt(run)) {
    return run;
  }
  return { ...run, ended: economy.buildRunEndSummary(run, 'bankruptcy') };
}

/**
 * 终战败「重试当日」（S-19。gdd「重新开始」）: 第 20 日夜開戦前快照から復帰する。
 * 银子/声望/侠点/伙计状态（岗位・疲劳込み）を快照値へ戻し（援助费用支払い済みの状態も
 * 快照値で上書き＝実質返金）、nightStage='battle' の開戦前選択から再開する。
 * 不正な快照值は createResumeRun 同型の夹み込みで既定値へ（破損扱いは persistence 层が担当）。
 */
export function createBattleRetryRun(snapshot: FinalBattleSnapshot): RunState {
  const ambition = isAmbitionId(snapshot.ambition) ? snapshot.ambition : AMBITION.DEFAULT_ID;
  const base = createRunForPack(getAmbitionPack(ambition));
  const restored: RunState = {
    ...base,
    day: DAY_CYCLE.FINAL_BATTLE_DAY,
    phase: 'night',
    nightStage: 'battle',
    silver: typeof snapshot.silver === 'number' ? snapshot.silver : base.silver,
    reputation: typeof snapshot.reputation === 'number' ? snapshot.reputation : base.reputation,
    xiaPoints: typeof snapshot.xiaPoints === 'number' ? snapshot.xiaPoints : base.xiaPoints,
    staff: Array.isArray(snapshot.staff) && snapshot.staff.length > 0 ? snapshot.staff : base.staff,
    finalBattleNight: true,
  };
  return { ...restored, finalBattle: createBattleState(restored) };
}
