/**
 * runEngine — 周目内状態の组合根（S-03/S-05/S-06/S-08/S-09 の systems を唯一の入口に束ねる）。
 * GameScene は本モジュールの createInitialRun / advanceRun / handleTapEvent だけを呼ぶ
 * （Scene 轻薄 — tech-stack 规范 3）。状态は不可变更新、纯逻辑のみ（Phaser 非依赖）。
 */
import { AMBITION, MS_PER_SECOND, STAFF_ROSTER } from '../config';
import type { AmbitionId, PostId, RunState, RunSnapshot, TapHit } from '../types';
import { TAP_EVENTS } from '../types';
import { getAmbitionPack, isAmbitionId, type AmbitionPack } from './ambition';
import { selectPost, toggleAssignment } from './assignment';
import { applyTrainingGains } from './training';
import * as dayCycle from './dayCycle';
import * as economy from './economy';
import * as customerFlow from './customerFlow';
import { chooseOption, drawCard } from './eventCard';
import { intervalSecondsForDay } from './customerFlow';

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
    customerSeq: 0,
    finalBattleNight: false,
    ended: null,
  };
}

/**
 * 新周目の初期状態 = 志向选择（S-04）。財/侠/名が確定するまでの仮リソースは
 * DEFAULT_ID（config.AMBITION.DEFAULT_ID — Systems 層の破綻がないための安全夹）で埋める。
 */
export function createInitialRun(): RunState {
  const base = createRunForPack(getAmbitionPack(AMBITION.DEFAULT_ID));
  return { ...base, phase: 'ambition' };
}

/** 志向确认（S-04 acceptance）: 選択志向の GDD 初期值で晨间开局 */
export function confirmAmbition(run: RunState, ambitionId: AmbitionId): RunState {
  if (run.phase !== 'ambition') {
    return run;
  }
  return createRunForPack(getAmbitionPack(ambitionId));
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
 * 夜间「天明」→ 翌日晨间。第 20 日夜は「迎战」: 終戦演出の模擬は story S-19（build）で
 * 接线 — prototype では runComplete として Result へ迁移する暫定経路（判断事項）。
 */
function daybreakTap(run: RunState): RunState {
  if (run.phase !== 'night' || run.nightStage !== 'result') {
    return run; // 结果反馈を読み終えるまで推进しない（S-09 acceptance）
  }
  if (run.finalBattleNight) {
    return { ...run, ended: economy.buildRunEndSummary(run, 'runComplete') };
  }
  return dayCycle.daybreak(run);
}

/** 破产判定（夜结算後と收钱/事件 Δ 後に成立 — S-08 acceptance） */
function checkBankruptcy(run: RunState): RunState {
  if (run.ended !== null || !economy.isBankrupt(run)) {
    return run;
  }
  return { ...run, ended: economy.buildRunEndSummary(run, 'bankruptcy') };
}
