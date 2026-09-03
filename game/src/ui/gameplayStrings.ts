/**
 * 玩法侧的中文文案表（conventions 规则 4: 玩家可见文本全部经 key 查表 — 文案集中在表内）。
 * key 一览は src/textKeys.ts（systems が参照する依存方向を保つため分離）。
 * GameScene 侧で本表を優先し、欠落 key は ui/hudStrings の回落 provider に委ねる。
 * S-11 systems/i18n 落地后、本表は正式语言表へ迁移する（迁移时仅动本文件与接线 1 行）。
 */
import { TEXT_KEYS } from '../textKeys';

/** 中文文案表（prototype 阶段的全量。build S-24 で 5 语言化） */
export const GAMEPLAY_ZH_TABLE: Readonly<Record<string, string>> = {
  [TEXT_KEYS.MORNING_TITLE]: '晨间排班',
  [TEXT_KEYS.MORNING_HINT_SELECT_POST]: '点击岗位图标，选择要分配的岗位',
  [TEXT_KEYS.MORNING_HINT_SELECT_STAFF]: '再点击伙计头像完成指派（再点一次已指派伙计＝取消）',
  [TEXT_KEYS.NOTICE_ASSIGN_REJECTED]: '该岗位已满员，指派被拒绝',
  [TEXT_KEYS.BUTTON_OPEN_DOOR]: '开门营业',
  [TEXT_KEYS.POST_WAITER]: '跑堂',
  [TEXT_KEYS.POST_MANAGER]: '掌柜',
  [TEXT_KEYS.POST_PURCHASER]: '采购',
  [TEXT_KEYS.POST_TRAINING]: '修练',
  [TEXT_KEYS.POST_STANDBY]: '待命',
  [TEXT_KEYS.LABEL_COUNTER]: '柜台',
  [TEXT_KEYS.LABEL_SERVE_WINDOW]: '出餐口',
  [TEXT_KEYS.BUBBLE_ORDER]: '点单',
  [TEXT_KEYS.BUBBLE_PAYMENT]: '收银',
  [TEXT_KEYS.NIGHT_TITLE]: '夜间结算',
  [TEXT_KEYS.SUMMARY_INCOME]: '当日收入',
  [TEXT_KEYS.SUMMARY_REP_NET]: '声望净变',
  [TEXT_KEYS.SUMMARY_SERVED]: '服务成功',
  [TEXT_KEYS.SUMMARY_FAILED]: '服务失败',
  [TEXT_KEYS.SUMMARY_WAGE]: '工钱',
  [TEXT_KEYS.BUTTON_DRAW_CARD]: '翻卡',
  [TEXT_KEYS.CARD_TITLE_LABEL]: '事件卡',
  [TEXT_KEYS.CARD_RESULT_LABEL]: '结果',
  [TEXT_KEYS.BUTTON_DAYBREAK]: '天明',
  [TEXT_KEYS.BUTTON_FIGHT]: '迎战',
  [TEXT_KEYS.FINAL_BATTLE_NOTICE]: '第 20 夜 — 江湖大敌来袭！',
  [TEXT_KEYS.STAFF_AFU]: '阿福',
  [TEXT_KEYS.STAFF_TIENIU]: '铁牛',
  [TEXT_KEYS.STAFF_WENQU]: '文曲',
  [TEXT_KEYS.STAFF_XIAODIE]: '小蝶',
  [TEXT_KEYS.STAFF_DASONG]: '大嵩',
  [TEXT_KEYS.CARD_1_TITLE]: '镖师借宿',
  [TEXT_KEYS.CARD_1_OPT1]: '赠银送行（银 −15 / 声望 +6）',
  [TEXT_KEYS.CARD_1_OPT1_RESULT]: '镖师感激离去，客栈声名渐起',
  [TEXT_KEYS.CARD_1_OPT2]: '收留借宿（银 +12 / 侠点 +3）',
  [TEXT_KEYS.CARD_1_OPT2_RESULT]: '镖师留下房钱，还传授了几手防身功夫',
  [TEXT_KEYS.CARD_5_TITLE]: '同行拆台',
  [TEXT_KEYS.CARD_5_OPT1]: '当面拆穿（声望 +8）',
  [TEXT_KEYS.CARD_5_OPT1_RESULT]: '当众揭穿诡计，客人都赞客栈光明磊落',
  [TEXT_KEYS.CARD_5_OPT2]: '破财免灾（银 −20 / 声望 +2）',
  [TEXT_KEYS.CARD_5_OPT2_RESULT]: '花银子消灾，好在太平无事',
  [TEXT_KEYS.CARD_8_TITLE]: '商队歇脚',
  [TEXT_KEYS.CARD_8_OPT1]: '高价售粮（银 +15）',
  [TEXT_KEYS.CARD_8_OPT1_RESULT]: '商队慷慨付账，银子入柜',
  [TEXT_KEYS.CARD_8_OPT2]: '平价相售（银 +4 / 声望 +5）',
  [TEXT_KEYS.CARD_8_OPT2_RESULT]: '商队感念实惠，逢人便夸客栈厚道',
};
