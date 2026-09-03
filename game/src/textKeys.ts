/**
 * 玩法侧玩家可见文本的 key 一览（conventions 规则 4: 文案零硬编码）。
 * systems は key のみを参照（文案を知らない）。中文文案表は ui/gameplayStrings.ts、
 * 查表は TextProvider（S-11 systems/i18n 落地后由正式查表接管）。
 * ui/ からも本モジュールの key を参照する（依存方向: ui → 共通 → systems を崩さないため
 * key 定数だけを这里に置く — systems が ui/ を import しない）。
 */
export const TEXT_KEYS = {
  // 晨间（S-05 排班）
  MORNING_TITLE: 'morning.title',
  MORNING_HINT_SELECT_POST: 'morning.hint.selectPost',
  MORNING_HINT_SELECT_STAFF: 'morning.hint.selectStaff',
  NOTICE_ASSIGN_REJECTED: 'morning.notice.assignRejected',
  BUTTON_OPEN_DOOR: 'morning.button.openDoor',
  POST_WAITER: 'post.waiter',
  POST_MANAGER: 'post.manager',
  POST_PURCHASER: 'post.purchaser',
  POST_TRAINING: 'post.training',
  POST_STANDBY: 'post.standby',
  // 日间（S-06 接客）
  LABEL_COUNTER: 'day.label.counter',
  LABEL_SERVE_WINDOW: 'day.label.serveWindow',
  BUBBLE_ORDER: 'day.bubble.order',
  BUBBLE_PAYMENT: 'day.bubble.payment',
  // 夜间（S-09 结算与事件卡）
  NIGHT_TITLE: 'night.title',
  SUMMARY_INCOME: 'night.summary.income',
  SUMMARY_REP_NET: 'night.summary.repNet',
  SUMMARY_SERVED: 'night.summary.served',
  SUMMARY_FAILED: 'night.summary.failed',
  SUMMARY_WAGE: 'night.summary.wage',
  BUTTON_DRAW_CARD: 'night.button.draw',
  CARD_TITLE_LABEL: 'night.card.title',
  CARD_RESULT_LABEL: 'night.card.result',
  BUTTON_DAYBREAK: 'night.button.daybreak',
  BUTTON_FIGHT: 'night.button.fight',
  FINAL_BATTLE_NOTICE: 'night.finalBattleNotice',
  // 伙计名（gdd「伙计初始值」5 名）
  STAFF_AFU: 'staff.afu',
  STAFF_TIENIU: 'staff.tieniu',
  STAFF_WENQU: 'staff.wenqu',
  STAFF_XIAODIE: 'staff.xiaodie',
  STAFF_DASONG: 'staff.dasong',
  // 事件卡（垂直切片 3 张 — gdd「事件卡」表の #1/#5/#8。build S-17 で 15 张に拡張）
  CARD_1_TITLE: 'card.1.title',
  CARD_1_OPT1: 'card.1.opt1',
  CARD_1_OPT1_RESULT: 'card.1.opt1.result',
  CARD_1_OPT2: 'card.1.opt2',
  CARD_1_OPT2_RESULT: 'card.1.opt2.result',
  CARD_5_TITLE: 'card.5.title',
  CARD_5_OPT1: 'card.5.opt1',
  CARD_5_OPT1_RESULT: 'card.5.opt1.result',
  CARD_5_OPT2: 'card.5.opt2',
  CARD_5_OPT2_RESULT: 'card.5.opt2.result',
  CARD_8_TITLE: 'card.8.title',
  CARD_8_OPT1: 'card.8.opt1',
  CARD_8_OPT1_RESULT: 'card.8.opt1.result',
  CARD_8_OPT2: 'card.8.opt2',
  CARD_8_OPT2_RESULT: 'card.8.opt2.result',
} as const;
