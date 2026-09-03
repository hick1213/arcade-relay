/**
 * eventCard — 事件卡系统（S-09。gdd「事件卡系统」: 抽卡→选项→银子/声望/侠点 Δ）。
 * 卡池（数据表）は eventCardData.ts と分離。每夜 1 张、不重复弃牌。
 * 适配志向の选项は正の Δ に AMBITION_BIAS 偏移（gdd「数值表」AMBITION_BIAS）。
 * 纯函数・Phaser 非依赖。
 */
import { AMBITION } from '../config';
import type { RunState } from '../types';
import { EVENT_CARD_POOL } from './eventCardData';

/** 夜间「翻卡」→ 池から 1 枚抽選（弃牌堆を除く。全弃时は弃牌堆をリセット — 保底路径） */
export function drawCard(run: RunState): RunState {
  if (run.phase !== 'night' || run.nightStage !== 'summary') {
    return run;
  }
  const remaining = EVENT_CARD_POOL.filter((card) => !run.discardedCardIds.includes(card.id));
  const pool = remaining.length > 0 ? remaining : EVENT_CARD_POOL;
  // pool は常に 1 枚以上（空 pool は EVENT_CARD_POOL に置換済み）
  const card = pool[Math.floor(Math.random() * pool.length)] as (typeof pool)[number];
  return {
    ...run,
    nightStage: 'card',
    drawnCard: { cardId: card.id, chosenIndex: null, resultTextKey: null },
    discardedCardIds: [...run.discardedCardIds, card.id],
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
