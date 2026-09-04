/**
 * eventCard — 事件卡系统（S-09。gdd「事件卡系统」: 抽卡→选项→银子/声望/侠点 Δ）。
 * 卡池（数据表）は eventCardData.ts と分離。每夜 1 张、不重复弃牌。
 * 适配志向の选项は正の Δ に AMBITION_BIAS 偏移（gdd「数值表」AMBITION_BIAS）。
 * 纯函数・Phaser 非依赖。
 */
import { AMBITION } from '../config';
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
  return {
    ...run,
    silver: run.silver + biased(option.silverDelta),
    reputation: run.reputation + biased(option.reputationDelta),
    xiaPoints: run.xiaPoints + biased(option.xiaDelta),
    nightStage: 'result',
    drawnCard: { ...run.drawnCard, chosenIndex: optionIndex, resultTextKey: option.resultTextKey },
  };
}
