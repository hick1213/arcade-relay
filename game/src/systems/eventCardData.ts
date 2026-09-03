/**
 * 事件卡数据表（S-09。垂直切片用 3 张 — gdd「事件卡」表の #1 镖师借宿 / #5 同行拆台 / #8 商队歇脚）。
 * 数据表与逻辑分离（eventCard.ts が本表を参照）。build S-17 で 15 张に拡張 — 構造は不変。
 * 效果幅度は gdd テンプレート内: 银 Δ −25～+15 / 声望 Δ −10～+10 / 侠点 0–5 / 疲劳は build S-17。
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
];
