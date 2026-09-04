/**
 * eventCard — 事件卡系统（S-09。gdd「事件卡系统」: 抽卡→选项→银子/声望/侠点 Δ）。
 * 卡池（数据表）は eventCardData.ts と分離。每夜 1 张、不重复弃牌。
 * 适配志向の选项は正の Δ に AMBITION_BIAS 偏移（gdd「数值表」AMBITION_BIAS）。
 * 纯函数・Phaser 非依赖。
 */
import { AMBITION, EVENT } from '../config';
import type { RunState } from '../types';
import { EVENT_CARD_POOL } from './eventCardData';

/** 夜间「翻卡」→ 池から 1 枚抽選（弃牌堆を除く。弃牌堆が尽きた時点で重洗 —
 * gdd「事件卡系统」。重洗後は弃牌堆を今回の 1 枚だけて再構成 — S-23 快照の対象も最小に保つ） */
export function drawCard(run: RunState): RunState {
  if (run.phase !== 'night' || run.nightStage !== 'summary') {
    return run;
  }
  const remaining = EVENT_CARD_POOL.filter((card) => !run.discardedCardIds.includes(card.id));
  const reshuffled = remaining.length === 0;
  // pool は常に 1 枚以上（重洗時は全池に戻す。EVENT_CARD_POOL は定数て非空）
  const pool = reshuffled ? EVENT_CARD_POOL : remaining;
  const card = pool[Math.floor(Math.random() * pool.length)] as (typeof pool)[number];
  return {
    ...run,
    nightStage: 'card',
    drawnCard: { cardId: card.id, chosenIndex: null, resultTextKey: null },
    discardedCardIds: reshuffled ? [card.id] : [...run.discardedCardIds, card.id],
  };
}

/**
 * 事件卡の疲劳適用（S-18。gdd「事件卡」テンプレート: 疲劳概率 ≤20% = EVENT.FATIGUE_CHANCE）。
 * mayFatigue 选项が選ばれた夜に roll（roll < FATIGUE_CHANCE で成立）し、指定伙计 1 名に
 * 疲劳を标记する。適用は「翌日の晨间以降の动作耗时」に効く（run.nightFatigueIds に記録し、
 * daybreak が本夜の適用分のみ翌日に持ち越して前日分を回復 — 次日生效）。
 * roll と対象選択は呼出側（chooseOption — Math.random）から注入する纯函数（单测は決定的に検証）。
 */
export function applyEventFatigue(run: RunState, roll: number, targetIndex: number): RunState {
  if (roll >= EVENT.FATIGUE_CHANCE) {
    return run;
  }
  const target = run.staff[targetIndex];
  if (target === undefined) {
    return run;
  }
  return {
    ...run,
    staff: run.staff.map((member) =>
      member.id === target.id ? { ...member, fatigue: true } : member,
    ),
    nightFatigueIds: run.nightFatigueIds.includes(target.id)
      ? run.nightFatigueIds
      : [...run.nightFatigueIds, target.id],
  };
}

/** 点击事件卡选项 → Δ 执行（结果反馈を読むまで「天明」は出ない — nightStage='result'） */
export function chooseOption(run: RunState, optionIndex: number): RunState {
  if (run.drawnCard === null || run.drawnCard.chosenIndex !== null) {
    return run;
  }
  const card = EVENT_CARD_POOL.find((candidate) => candidate.id === run.drawnCard?.cardId);
  const option = card?.options[optionIndex];
  if (option === undefined) {
    return run;
  }
  const bias = option.favoredAmbition === run.ambition ? 1 + AMBITION.BIAS : 1;
  const biased = (delta: number): number => (delta > 0 ? Math.round(delta * bias) : delta);
  const withDelta = {
    ...run,
    silver: run.silver + biased(option.silverDelta),
    reputation: run.reputation + biased(option.reputationDelta),
    xiaPoints: run.xiaPoints + biased(option.xiaDelta),
  };
  // 疲劳 roll は mayFatigue 选项のみ（S-17 卡数据表の标记と対 — gdd 疲劳概率 ≤20%）
  const applied =
    option.mayFatigue === true
      ? applyEventFatigue(
          withDelta,
          Math.random(),
          Math.floor(Math.random() * run.staff.length),
        )
      : withDelta;
  return {
    ...applied,
    nightStage: 'result',
    drawnCard: { ...run.drawnCard, chosenIndex: optionIndex, resultTextKey: option.resultTextKey },
  };
}
