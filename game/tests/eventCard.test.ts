/**
 * eventCard.test.ts — S-17 事件卡全 15 张与志向偏移的验收测试（systems 层纯逻辑）。
 *
 * - 卡池 = gdd「事件卡」表全 15 张（id 1–15）、每卡 2–3 选项。
 * - 效果幅度在 gdd 模板内: 银 Δ −25～+15 / 声望 Δ −10～+10 / 侠点 0–5
 *   （境界は config.EVENT の SILVER_DELTA_MIN/MAX・REPUTATION_DELTA_MIN/MAX・XIA_POINT_MAX 定数を参照）。
 * - AMBITION_BIAS=0.3: 适配志向开局时同一选项的正 Δ 收益 +30%（偏移后数值断言）。
 * - 侠系选项累计侠点（侠选项卡片 = #1/2/3/6/7/11/13/15 — gdd「侠线可行性算式」）。
 * - 夜间每夜 1 张（非 summary 相位的抽卡被忽略）、弃牌堆用尽时重洗。
 * - 全部文案 key 在 zh/en 两表均有实体（S-11 conventions: 文案零硬编码）。
 *
 * 运行: cd game && npm test（vitest run）
 */
import { describe, expect, it } from 'vitest';
import { AMBITION, EVENT } from '../src/config';
import { chooseOption, drawCard } from '../src/systems/eventCard';
import { EVENT_CARD_POOL } from '../src/systems/eventCardData';
import { EN_TABLE } from '../src/systems/i18n/enTable';
import { ZH_TABLE } from '../src/systems/i18n/zhTable';
import { confirmAmbition, createInitialRun } from '../src/systems/runEngine';
import type { AmbitionId, RunState } from '../src/types';

/** gdd「事件卡」表: 含侠选项的 8 张卡（侠线可行性的供给侧前提） */
const XIA_CARDS = [1, 2, 3, 6, 7, 11, 13, 15] as const;

/** 志向确定 → 夜间 summary 相位（抽卡受付状態）の run を作る */
function nightRun(ambition: AmbitionId): RunState {
  const run = confirmAmbition(createInitialRun(), ambition);
  return { ...run, phase: 'night', nightStage: 'summary', drawnCard: null, discardedCardIds: [] };
}

/** 指定卡を未選択状態でセット（偏移断言用の決定的入力） */
function withCard(run: RunState, cardId: number): RunState {
  return { ...run, nightStage: 'card', drawnCard: { cardId, chosenIndex: null, resultTextKey: null } };
}

describe('S-17 卡池构成（gdd「事件卡」15 张一览）', () => {
  it('卡池は 15 张・id 1–15 と一致する', () => {
    expect(EVENT_CARD_POOL).toHaveLength(15);
    expect(EVENT_CARD_POOL.map((card) => card.id).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    ]);
  });

  it('每卡 2–3 选项を持つ', () => {
    for (const card of EVENT_CARD_POOL) {
      expect(card.options.length, `card #${card.id}`).toBeGreaterThanOrEqual(2);
      expect(card.options.length, `card #${card.id}`).toBeLessThanOrEqual(3);
    }
  });

  it('效果幅度は gdd テンプレート内（境界は config EVENT の定数参照）', () => {
    for (const card of EVENT_CARD_POOL) {
      for (const option of card.options) {
        expect(option.silverDelta, `card #${card.id} silver`).toBeGreaterThanOrEqual(EVENT.SILVER_DELTA_MIN);
        expect(option.silverDelta, `card #${card.id} silver`).toBeLessThanOrEqual(EVENT.SILVER_DELTA_MAX);
        expect(option.reputationDelta, `card #${card.id} reputation`).toBeGreaterThanOrEqual(
          EVENT.REPUTATION_DELTA_MIN,
        );
        expect(option.reputationDelta, `card #${card.id} reputation`).toBeLessThanOrEqual(
          EVENT.REPUTATION_DELTA_MAX,
        );
        expect(option.xiaDelta, `card #${card.id} xia`).toBeGreaterThanOrEqual(0);
        expect(option.xiaDelta, `card #${card.id} xia`).toBeLessThanOrEqual(EVENT.XIA_POINT_MAX);
      }
    }
  });

  it('侠选项カードは gdd 表の 8 张（#1/2/3/6/7/11/13/15）と一致し、侠点は定数値', () => {
    const withXia = EVENT_CARD_POOL.filter((card) =>
      card.options.some((option) => option.xiaDelta > 0),
    ).map((card) => card.id);
    expect(withXia.sort((a, b) => a - b)).toEqual([...XIA_CARDS]);
    for (const card of EVENT_CARD_POOL) {
      for (const option of card.options) {
        if (option.xiaDelta > 0) {
          expect(option.xiaDelta).toBe(EVENT.XIA_POINT_PER_CHOICE);
        }
      }
    }
  });

  it('全文案 key が zh/en 両表に存在する（欠落文案は無い）', () => {
    for (const card of EVENT_CARD_POOL) {
      const keys = [card.titleKey, ...card.options.flatMap((o) => [o.textKey, o.resultTextKey])];
      for (const key of keys) {
        expect(ZH_TABLE[key], `zh ${key}`).toBeTruthy();
        expect(EN_TABLE[key], `en ${key}`).toBeTruthy();
      }
    }
  });
});

describe('S-17 志向偏移（AMBITION_BIAS=0.3 — 偏移後の数值断言）', () => {
  it('侠志向开局て卡 #1 选项 2（侠适配）: 银 +12→+16、侠点 +3→+4（×1.3 四捨五入）', () => {
    const run = withCard(nightRun('xia'), 1);
    const next = chooseOption(run, 1);
    expect(next.silver).toBe(AMBITION.START.xia.silver + 16); // 12 × 1.3 = 15.6 → 16
    expect(next.xiaPoints).toBe(4); // 3 × 1.3 = 3.9 → 4
    expect(next.reputation).toBe(AMBITION.START.xia.reputation);
  });

  it('非适配志向（財）て同じ选项: 偏移なしの基礎値どおり', () => {
    const run = withCard(nightRun('wealth'), 1);
    const next = chooseOption(run, 1);
    expect(next.silver).toBe(AMBITION.START.wealth.silver + 12);
    expect(next.xiaPoints).toBe(3);
  });

  it('負の Δ は适配志向ても偏移しない（卡 #1 选项 1 を名志向て選択 → 正 Δ のみ ×1.3）', () => {
    const run = withCard(nightRun('fame'), 1);
    const next = chooseOption(run, 0);
    expect(next.silver).toBe(AMBITION.START.fame.silver - 15); // 負 Δ はそのまま
    expect(next.reputation).toBe(AMBITION.START.fame.reputation + 8); // 6 × 1.3 = 7.8 → 8
  });

  it('侠系选项の選択を重ねると侠点が累積する', () => {
    let run = nightRun('xia');
    // 卡 #1 选项 2（侠 +4 偏移後）→ 卡 #2 选项 2（侠 +4 偏移後）
    run = chooseOption(withCard(run, 1), 1);
    run = chooseOption(withCard({ ...run, drawnCard: null }, 2), 1);
    expect(run.xiaPoints).toBe(8); // 4 + 4
  });
});

describe('S-17 抽卡と弃牌堆（每夜 1 张・尽きたら重洗）', () => {
  it('summary 相位の「翻卡」て 1 枚引き、選択済みは無視（毎夜 1 張）', () => {
    let run = drawCard(nightRun('wealth'));
    expect(run.nightStage).toBe('card');
    expect(run.drawnCard).not.toBeNull();
    // card 相位ての再抽卡は無視される（同じ run のまま）
    expect(drawCard(run)).toBe(run);
  });

  it('弃牌堆は重複しない（未弃カードからのみ抽選）', () => {
    let run = nightRun('wealth');
    for (let i = 0; i < 10; i += 1) {
      run = drawCard(run);
      expect(run.drawnCard).not.toBeNull();
      const drawn = run.drawnCard?.cardId as number;
      expect(run.discardedCardIds.filter((id) => id === drawn)).toHaveLength(1);
      // 次の夜へ（result → summary を模擬）
      run = { ...run, nightStage: 'summary' };
    }
    expect(run.discardedCardIds).toHaveLength(10);
  });

  it('弃牌堆を 15 張使い切った次の抽選て重洗され、弃牌堆は 1 枚に戻る', () => {
    let run = nightRun('wealth');
    for (let i = 0; i < 15; i += 1) {
      run = drawCard(run);
      expect(run.discardedCardIds.length).toBe(i + 1); // 重複なく蓄積
      run = { ...run, nightStage: 'summary' };
    }
    expect(run.discardedCardIds).toHaveLength(15);
    const reshuffled = drawCard(run);
    expect(reshuffled.drawnCard).not.toBeNull();
    expect(reshuffled.discardedCardIds).toHaveLength(1); // 重洗: 今回の 1 枚のみ
  });

  it('重洗後も 15 張すべてが再抽選の対象に戻る（連続 30 夜て全 id が再登場）', () => {
    let run = nightRun('wealth');
    const seen = new Set<number>();
    for (let i = 0; i < 30; i += 1) {
      run = drawCard(run);
      seen.add((run.drawnCard as { cardId: number }).cardId);
      run = { ...run, nightStage: 'summary' };
    }
    expect(seen.size).toBe(15);
  });
});
