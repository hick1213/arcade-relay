/**
 * 事件卡数据表（S-17: 全 15 张 — gdd「事件卡」表。prototype S-09 は 3 张の垂直切片、
 * build S-17 で 15 张に拡張 — #1/#5/#8 の数值は不変）。
 * 数据表与逻辑分离（eventCard.ts が本表を参照）。
 * 效果幅度は gdd テンプレート内: 银 Δ −25～+15 / 声望 Δ −10～+10 / 侠点 0–5
 * （境界は config EVENT.SILVER_DELTA_* / REPUTATION_DELTA_* / XIA_POINT_MAX —
 * テストの検証は本定数を参照。每卡の具体値は内容データなので直値のまま）。
 * （侠 Δ は全选项 EVENT.XIA_POINT_PER_CHOICE — 値の一元化。侠选项カードは
 * #1/#2/#3/#6/#7/#11/#13/#15 の 8 张 = gdd「侠线可行性算式」の前提）。
 * mayFatigue は伙计疲劳结果の标记（確率 roll と施加は S-18 接线 — config.EVENT.FATIGUE_CHANCE）。
 * 文案は i18n key（実テキストは systems/i18n/zhTable.ts の中文表 — S-11）。
 */
import { EVENT } from '../config';
import { TEXT_KEYS } from '../textKeys';
import type { EventCardData } from '../types';

export const EVENT_CARD_POOL: readonly EventCardData[] = [
  {
    id: 1,
    titleKey: TEXT_KEYS.CARD_1_TITLE,
    options: [
      {
        textKey: TEXT_KEYS.CARD_1_OPT1,
        resultTextKey: TEXT_KEYS.CARD_1_OPT1_RESULT,
        silverDelta: -15,
        reputationDelta: 6,
        xiaDelta: 0,
        favoredAmbition: 'fame',
      },
      {
        textKey: TEXT_KEYS.CARD_1_OPT2,
        resultTextKey: TEXT_KEYS.CARD_1_OPT2_RESULT,
        silverDelta: 12,
        reputationDelta: 0,
        xiaDelta: EVENT.XIA_POINT_PER_CHOICE,
        favoredAmbition: 'xia',
      },
    ],
  },
  {
    id: 2,
    titleKey: TEXT_KEYS.CARD_2_TITLE,
    options: [
      {
        textKey: TEXT_KEYS.CARD_2_OPT1,
        resultTextKey: TEXT_KEYS.CARD_2_OPT1_RESULT,
        silverDelta: 0,
        reputationDelta: 6,
        xiaDelta: 0,
        favoredAmbition: 'fame',
      },
      {
        textKey: TEXT_KEYS.CARD_2_OPT2,
        resultTextKey: TEXT_KEYS.CARD_2_OPT2_RESULT,
        silverDelta: -10,
        reputationDelta: 0,
        xiaDelta: EVENT.XIA_POINT_PER_CHOICE,
        favoredAmbition: 'xia',
      },
      {
        textKey: TEXT_KEYS.CARD_2_OPT3,
        resultTextKey: TEXT_KEYS.CARD_2_OPT3_RESULT,
        silverDelta: -15,
        reputationDelta: 0,
        xiaDelta: 0,
        favoredAmbition: null,
      },
    ],
  },
  {
    id: 3,
    titleKey: TEXT_KEYS.CARD_3_TITLE,
    options: [
      {
        textKey: TEXT_KEYS.CARD_3_OPT1,
        resultTextKey: TEXT_KEYS.CARD_3_OPT1_RESULT,
        silverDelta: -8,
        reputationDelta: 0,
        xiaDelta: EVENT.XIA_POINT_PER_CHOICE,
        favoredAmbition: 'xia',
      },
      {
        textKey: TEXT_KEYS.CARD_3_OPT2,
        resultTextKey: TEXT_KEYS.CARD_3_OPT2_RESULT,
        silverDelta: -5,
        reputationDelta: 7,
        xiaDelta: 0,
        favoredAmbition: 'fame',
      },
    ],
  },
  {
    id: 4,
    titleKey: TEXT_KEYS.CARD_4_TITLE,
    options: [
      {
        textKey: TEXT_KEYS.CARD_4_OPT1,
        resultTextKey: TEXT_KEYS.CARD_4_OPT1_RESULT,
        silverDelta: -18,
        reputationDelta: -6,
        xiaDelta: 0,
        favoredAmbition: null,
      },
      {
        textKey: TEXT_KEYS.CARD_4_OPT2,
        resultTextKey: TEXT_KEYS.CARD_4_OPT2_RESULT,
        silverDelta: -4,
        reputationDelta: 8,
        xiaDelta: 0,
        favoredAmbition: 'fame',
      },
    ],
  },
  {
    id: 5,
    titleKey: TEXT_KEYS.CARD_5_TITLE,
    options: [
      {
        textKey: TEXT_KEYS.CARD_5_OPT1,
        resultTextKey: TEXT_KEYS.CARD_5_OPT1_RESULT,
        silverDelta: 0,
        reputationDelta: 8,
        xiaDelta: 0,
        favoredAmbition: 'fame',
      },
      {
        textKey: TEXT_KEYS.CARD_5_OPT2,
        resultTextKey: TEXT_KEYS.CARD_5_OPT2_RESULT,
        silverDelta: -20,
        reputationDelta: 2,
        xiaDelta: 0,
        favoredAmbition: null,
      },
    ],
  },
  {
    id: 6,
    titleKey: TEXT_KEYS.CARD_6_TITLE,
    options: [
      {
        textKey: TEXT_KEYS.CARD_6_OPT1,
        resultTextKey: TEXT_KEYS.CARD_6_OPT1_RESULT,
        silverDelta: -12,
        reputationDelta: 0,
        xiaDelta: EVENT.XIA_POINT_PER_CHOICE,
        favoredAmbition: 'xia',
      },
      {
        textKey: TEXT_KEYS.CARD_6_OPT2,
        resultTextKey: TEXT_KEYS.CARD_6_OPT2_RESULT,
        silverDelta: 2,
        reputationDelta: 6,
        xiaDelta: 0,
        favoredAmbition: 'fame',
      },
    ],
  },
  {
    id: 7,
    titleKey: TEXT_KEYS.CARD_7_TITLE,
    options: [
      {
        textKey: TEXT_KEYS.CARD_7_OPT1,
        resultTextKey: TEXT_KEYS.CARD_7_OPT1_RESULT,
        silverDelta: -25,
        reputationDelta: 3,
        xiaDelta: EVENT.XIA_POINT_PER_CHOICE,
        favoredAmbition: 'xia',
      },
      {
        textKey: TEXT_KEYS.CARD_7_OPT2,
        resultTextKey: TEXT_KEYS.CARD_7_OPT2_RESULT,
        silverDelta: 8,
        reputationDelta: -5,
        xiaDelta: 0,
        favoredAmbition: 'wealth',
      },
    ],
  },
  {
    id: 8,
    titleKey: TEXT_KEYS.CARD_8_TITLE,
    options: [
      {
        textKey: TEXT_KEYS.CARD_8_OPT1,
        resultTextKey: TEXT_KEYS.CARD_8_OPT1_RESULT,
        silverDelta: 15,
        reputationDelta: 0,
        xiaDelta: 0,
        favoredAmbition: 'wealth',
      },
      {
        textKey: TEXT_KEYS.CARD_8_OPT2,
        resultTextKey: TEXT_KEYS.CARD_8_OPT2_RESULT,
        silverDelta: 4,
        reputationDelta: 5,
        xiaDelta: 0,
        favoredAmbition: null,
      },
    ],
  },
  {
    id: 9,
    titleKey: TEXT_KEYS.CARD_9_TITLE,
    options: [
      {
        textKey: TEXT_KEYS.CARD_9_OPT1,
        resultTextKey: TEXT_KEYS.CARD_9_OPT1_RESULT,
        silverDelta: -15,
        reputationDelta: 4,
        xiaDelta: 0,
        favoredAmbition: 'wealth',
      },
      {
        textKey: TEXT_KEYS.CARD_9_OPT2,
        resultTextKey: TEXT_KEYS.CARD_9_OPT2_RESULT,
        silverDelta: 5,
        reputationDelta: -3,
        xiaDelta: 0,
        favoredAmbition: null,
      },
    ],
  },
  {
    id: 10,
    titleKey: TEXT_KEYS.CARD_10_TITLE,
    options: [
      {
        textKey: TEXT_KEYS.CARD_10_OPT1,
        resultTextKey: TEXT_KEYS.CARD_10_OPT1_RESULT,
        silverDelta: 15,
        reputationDelta: 2,
        xiaDelta: 0,
        favoredAmbition: 'wealth',
      },
      {
        textKey: TEXT_KEYS.CARD_10_OPT2,
        resultTextKey: TEXT_KEYS.CARD_10_OPT2_RESULT,
        silverDelta: 0,
        reputationDelta: -4,
        xiaDelta: 0,
        favoredAmbition: null,
      },
    ],
  },
  {
    id: 11,
    titleKey: TEXT_KEYS.CARD_11_TITLE,
    options: [
      {
        textKey: TEXT_KEYS.CARD_11_OPT1,
        resultTextKey: TEXT_KEYS.CARD_11_OPT1_RESULT,
        silverDelta: -10,
        reputationDelta: 0,
        xiaDelta: EVENT.XIA_POINT_PER_CHOICE,
        favoredAmbition: 'xia',
        mayFatigue: true,
      },
      {
        textKey: TEXT_KEYS.CARD_11_OPT2,
        resultTextKey: TEXT_KEYS.CARD_11_OPT2_RESULT,
        silverDelta: 2,
        reputationDelta: 1,
        xiaDelta: 0,
        favoredAmbition: null,
      },
    ],
  },
  {
    id: 12,
    titleKey: TEXT_KEYS.CARD_12_TITLE,
    options: [
      {
        textKey: TEXT_KEYS.CARD_12_OPT1,
        resultTextKey: TEXT_KEYS.CARD_12_OPT1_RESULT,
        silverDelta: -18,
        reputationDelta: 0,
        xiaDelta: 0,
        favoredAmbition: null,
      },
      {
        textKey: TEXT_KEYS.CARD_12_OPT2,
        resultTextKey: TEXT_KEYS.CARD_12_OPT2_RESULT,
        silverDelta: 10,
        reputationDelta: 0,
        xiaDelta: 0,
        favoredAmbition: 'wealth',
        mayFatigue: true,
      },
    ],
  },
  {
    id: 13,
    titleKey: TEXT_KEYS.CARD_13_TITLE,
    options: [
      {
        textKey: TEXT_KEYS.CARD_13_OPT1,
        resultTextKey: TEXT_KEYS.CARD_13_OPT1_RESULT,
        silverDelta: -5,
        reputationDelta: 4,
        xiaDelta: EVENT.XIA_POINT_PER_CHOICE,
        favoredAmbition: 'xia',
      },
      {
        textKey: TEXT_KEYS.CARD_13_OPT2,
        resultTextKey: TEXT_KEYS.CARD_13_OPT2_RESULT,
        silverDelta: -15,
        reputationDelta: 5,
        xiaDelta: 0,
        favoredAmbition: 'fame',
      },
    ],
  },
  {
    id: 14,
    titleKey: TEXT_KEYS.CARD_14_TITLE,
    options: [
      {
        textKey: TEXT_KEYS.CARD_14_OPT1,
        resultTextKey: TEXT_KEYS.CARD_14_OPT1_RESULT,
        silverDelta: 8,
        reputationDelta: -3,
        xiaDelta: 0,
        favoredAmbition: 'wealth',
      },
      {
        textKey: TEXT_KEYS.CARD_14_OPT2,
        resultTextKey: TEXT_KEYS.CARD_14_OPT2_RESULT,
        silverDelta: -12,
        reputationDelta: 5,
        xiaDelta: 0,
        favoredAmbition: 'fame',
      },
    ],
  },
  {
    id: 15,
    titleKey: TEXT_KEYS.CARD_15_TITLE,
    options: [
      {
        textKey: TEXT_KEYS.CARD_15_OPT1,
        resultTextKey: TEXT_KEYS.CARD_15_OPT1_RESULT,
        silverDelta: -10,
        reputationDelta: 0,
        xiaDelta: EVENT.XIA_POINT_PER_CHOICE,
        favoredAmbition: 'xia',
      },
      {
        textKey: TEXT_KEYS.CARD_15_OPT2,
        resultTextKey: TEXT_KEYS.CARD_15_OPT2_RESULT,
        silverDelta: 0,
        reputationDelta: 4,
        xiaDelta: 0,
        favoredAmbition: 'fame',
      },
      {
        textKey: TEXT_KEYS.CARD_15_OPT3,
        resultTextKey: TEXT_KEYS.CARD_15_OPT3_RESULT,
        silverDelta: 2,
        reputationDelta: 0,
        xiaDelta: 0,
        favoredAmbition: 'wealth',
      },
    ],
  },
];
