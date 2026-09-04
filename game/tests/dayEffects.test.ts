/**
 * dayEffects.test.ts — S-18 三属性日间效果与疲劳的验收测试（systems 层纯逻辑）。
 *
 * - 速度 = 动作耗时 ×max(ACTION_FACTOR_MIN, 1−SPEED_FACTOR×速度)（下限封顶）
 * - 手艺 = 制菜 ×(1−min(CRAFT_CAP, CRAFT_FACTOR×手艺))、掌勺 = 当日店内（岗位≠修练）
 *   手艺最高者（kitchen.headChefCraft。上限封顶）
 * - 体力 = 疲劳倍率 1+(FATIGUE_PENALTY−1)×(1−STAMINA_RESIST×体力)（减免 1 で封顶＝免疫。
 *   无疲劳时体力无日间效果）
 * - 事件卡 mayFatigue 选项 → EVENT.FATIGUE_CHANCE roll → 指定伙计に疲劳标记。
 *   疲劳は「次日生效」: 当夜適用分のみ daybreak で翌日に持ち越され、その翌日の天明で回復。
 *
 * 运行: cd game && npm test（vitest run）
 */
import { describe, expect, it } from 'vitest';
import { EVENT, KITCHEN, STAFF } from '../src/config';
import { craftReduction, fatigueMultiplier, speedMultiplier } from '../src/systems/dayEffects';
import { headChefCraft, prepTimeMs } from '../src/systems/kitchen';
import { applyEventFatigue, chooseOption } from '../src/systems/eventCard';
import { daybreak } from '../src/systems/dayCycle';
import { confirmAmbition, createInitialRun } from '../src/systems/runEngine';
import { EVENT_CARD_POOL } from '../src/systems/eventCardData';
import type { RunState } from '../src/types';

/** 志向确定 → 夜间（事件卡を引ける状態）の run。craft 最高は铁牛（tieniu = 3） */
function nightRun(): RunState {
  const run = confirmAmbition(createInitialRun(), 'wealth');
  return {
    ...run,
    phase: 'night',
    nightStage: 'card',
    drawnCard: { cardId: 11, chosenIndex: null, resultTextKey: null },
  };
}

describe('S-18 速度の日间效果（动作耗时倍率の下限封顶）', () => {
  it('速度 0 は等倍、速度 3（阿福）は 1−0.15×3 = 0.55 倍', () => {
    expect(speedMultiplier(0)).toBe(1);
    expect(speedMultiplier(3)).toBeCloseTo(1 - STAFF.SPEED_FACTOR * 3, 10);
  });

  it('高速度は ACTION_FACTOR_MIN で封顶（速度 STAT_MAX でも动作时间は 0 にならない）', () => {
    expect(speedMultiplier(STAFF.STAT_MAX)).toBe(STAFF.ACTION_FACTOR_MIN);
    expect(speedMultiplier(STAFF.STAT_MAX * 2)).toBe(STAFF.ACTION_FACTOR_MIN);
  });
});

describe('S-18 手艺の日间效果（制菜短缩の上限封顶 + 掌勺 = 店内最高手艺）', () => {
  it('craftReduction: 手艺 0 は无短缩、CRAFT_CAP/CRAFT_FACTOR（=6）でちょうど上限', () => {
    expect(craftReduction(0)).toBe(0);
    expect(craftReduction(KITCHEN.CRAFT_CAP / KITCHEN.CRAFT_FACTOR)).toBe(KITCHEN.CRAFT_CAP);
  });

  it('封顶境界: 手艺 STAT_MAX（10）でも短缩率は CRAFT_CAP のまま（それ以上短くならない）', () => {
    expect(craftReduction(STAFF.STAT_MAX)).toBe(KITCHEN.CRAFT_CAP);
    expect(prepTimeMs(KITCHEN.DISH_COUNT, STAFF.STAT_MAX)).toBe(
      prepTimeMs(KITCHEN.DISH_COUNT, KITCHEN.CRAFT_CAP / KITCHEN.CRAFT_FACTOR),
    );
  });

  it('制菜时间: 6 号菜は手艺 0 で 14s、封顶时 ×(1−CRAFT_CAP)', () => {
    const fullSeconds = KITCHEN.PREP_BASE_S + (KITCHEN.DISH_COUNT - 1) * KITCHEN.PREP_STEP_S;
    expect(prepTimeMs(KITCHEN.DISH_COUNT, 0)).toBe(fullSeconds * 1000);
    expect(prepTimeMs(KITCHEN.DISH_COUNT, STAFF.STAT_MAX)).toBeCloseTo(
      fullSeconds * (1 - KITCHEN.CRAFT_CAP) * 1000,
      6,
    );
  });

  it('掌勺 = 当日店内（岗位≠修练）の最高手艺。修练中の伙计は灶前にいないので不算', () => {
    const run = confirmAmbition(createInitialRun(), 'wealth');
    // 初期: 铁牛（艺 3）が店内最高
    expect(headChefCraft(run)).toBe(3);
    // 铁牛を修练に回すと次点（文曲 = 艺 2）が掌勺になる — gdd 記載の取舍
    const training = {
      ...run,
      staff: run.staff.map((member) =>
        member.id === 'tieniu' ? { ...member, post: 'training' as const } : member,
      ),
    };
    expect(headChefCraft(training)).toBe(2);
  });
});

describe('S-18 体力の日间效果（疲劳倍率の减免と免疫封顶）', () => {
  it('非疲劳时は等倍（体力は疲劳時のみ日间效果を持つ — gdd 注记）', () => {
    expect(fatigueMultiplier(0, false)).toBe(1);
    expect(fatigueMultiplier(STAFF.STAT_MAX, false)).toBe(1);
  });

  it('体力 0 は满倍率 FATIGUE_PENALTY、体力 4（大嵩）は 1+(1.2−1)×(1−0.05×4) = 1.16', () => {
    expect(fatigueMultiplier(0, true)).toBe(STAFF.FATIGUE_PENALTY);
    expect(fatigueMultiplier(4, true)).toBeCloseTo(1 + (STAFF.FATIGUE_PENALTY - 1) * 0.8, 10);
  });

  it('免疫境界: 减免项 STAMINA_RESIST×体力 が 1 に達したら倍率 1.0（疲劳无效化）で封顶', () => {
    const immuneStamina = 1 / STAFF.STAMINA_RESIST; // 減免がちょうど 1 になる体力
    expect(fatigueMultiplier(immuneStamina, true)).toBe(1);
    expect(fatigueMultiplier(immuneStamina * 2, true)).toBe(1);
    // 遊戲内の到達域（STAT_MAX = 10）では减免 0.5 — 高体力は「近乎免疫」（gdd 例: ×1.1）
    expect(fatigueMultiplier(STAFF.STAT_MAX, true)).toBeCloseTo(
      1 + (STAFF.FATIGUE_PENALTY - 1) * 0.5,
      10,
    );
  });
});

describe('S-18 事件卡の疲劳（mayFatigue → FATIGUE_CHANCE roll → 次日生效）', () => {
  it('roll ≥ FATIGUE_CHANCE は不成立（run 不変）', () => {
    const run = nightRun();
    const rolled = applyEventFatigue(run, EVENT.FATIGUE_CHANCE, 0);
    expect(rolled).toBe(run);
    expect(rolled.staff.every((member) => !member.fatigue)).toBe(true);
  });

  it('roll < FATIGUE_CHANCE は対象 1 名のみ疲劳标记 + nightFatigueIds に記録', () => {
    const run = nightRun();
    const targetId = run.staff[2]!.id;
    const rolled = applyEventFatigue(run, 0, 2);
    expect(rolled.staff.find((member) => member.id === targetId)?.fatigue).toBe(true);
    expect(rolled.staff.filter((member) => member.fatigue)).toHaveLength(1);
    expect(rolled.nightFatigueIds).toEqual([targetId]);
    expect(run.staff.every((member) => !member.fatigue)).toBe(true); // 元 run は不変
  });

  it('対象 index が範囲外なら不成立（纯函数の安全夹）', () => {
    const run = nightRun();
    expect(applyEventFatigue(run, 0, run.staff.length)).toBe(run);
  });

  it('次日生效: 当夜適用分は daybreak で翌日に持ち越され、さらにその翌日の天明で回復', () => {
    const run = nightRun();
    const targetId = run.staff[1]!.id;
    const rolled = applyEventFatigue(run, 0, 1);

    const nextMorning = daybreak(rolled); // 第 2 日晨间
    expect(nextMorning.day).toBe(2);
    expect(nextMorning.staff.find((member) => member.id === targetId)?.fatigue).toBe(true);
    expect(nextMorning.nightFatigueIds).toEqual([]);

    const followingMorning = daybreak(nextMorning); // 第 3 日晨间
    expect(followingMorning.staff.find((member) => member.id === targetId)?.fatigue).toBe(false);
  });

  it('前日から持ち越りの疲劳（当夜適用分ではない）は天明で回復する', () => {
    const run = nightRun();
    const targetId = run.staff[3]!.id;
    const carried = {
      ...run,
      staff: run.staff.map((member) =>
        member.id === targetId ? { ...member, fatigue: true } : member,
      ),
      nightFatigueIds: [], // 前日分 — 当夜の適用記録はなし
    };
    const nextMorning = daybreak(carried);
    expect(nextMorning.staff.find((member) => member.id === targetId)?.fatigue).toBe(false);
  });

  it('mayFatigue 以外の选项では疲劳が適用されない（roll は発生しない）', () => {
    const run = nightRun();
    // 卡 11 选项 2（index 1）= 以茶代酒 — mayFatigue 标记なし（eventCardData）
    const option = EVENT_CARD_POOL.find((card) => card.id === 11)!.options[1]!;
    expect(option.mayFatigue).toBeUndefined();
    const chosen = chooseOption(run, 1);
    expect(chosen.staff.every((member) => !member.fatigue)).toBe(true);
    expect(chosen.nightFatigueIds).toEqual([]);
  });
});
