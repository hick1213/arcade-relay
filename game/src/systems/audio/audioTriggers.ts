/**
 * 音频触发计划（S-27 — systems 纯逻辑、Phaser 非依存）。
 *
 * RunState 迁移差分＋语义化 tap 事件 → 「该响什么」的 SFX cue 列表与 BGM 轨道选择。
 * 判定基准 = design/assets.md「音频」节的 SFX 用途表与「复用映射」的变调方针。
 * 实际的音频输出（SoundManager 操作・循环・音量適用・autoplay 退避）は ui/AudioDirector —
 * 本文件は资产键与变体 id だけを返す（tech-stack 规范 3: 判定逻辑を systems へ）。
 */
import { ASSET_KEYS } from '../../config';
import type { SfxVariantId } from '../../config';
import type { CustomerState, RunState, TapEventName } from '../../types';
import { TAP_EVENTS } from '../../types';

/** 1 回の SFX 再生指示（key = ASSET_KEYS.audio の值。variant = config.AUDIO.SFX_VARIANTS の id） */
export interface SfxCue {
  readonly key: string;
  readonly variant: SfxVariantId | null;
}

const cue = (key: string, variant: SfxVariantId | null = null): SfxCue => ({ key, variant });

/** 客人の待ちステージ（customerFlow.tickPatience の対象 — この段階で patience 切离店=服务失败） */
const isWaitingStage = (customer: CustomerState): boolean =>
  customer.stage === 'awaitingOrder' || customer.stage === 'awaitingDish';

/** 耐心归零离店（服务失败 → SFX-06）客がいたか。收钱后の正常离店は対象外 */
const hasFailedDeparture = (
  prev: readonly CustomerState[],
  next: readonly CustomerState[],
): boolean => {
  const remainingIds = new Set(next.map((customer) => customer.id));
  return prev.some((customer) => !remainingIds.has(customer.id) && isWaitingStage(customer));
};

/** 上菜动作の完成（同 id 客の菜数増加または eating へ迁移 → SFX-04）。SERVE_WINDOW tap は
 * 派跑堂のみで完成ではないため、完成の差分側で 1 回だけ鳴らす（重複鳴動防止） */
const hasServeCompleted = (
  prev: readonly CustomerState[],
  next: readonly CustomerState[],
): boolean => {
  const prevById = new Map(prev.map((customer) => [customer.id, customer]));
  return next.some((customer) => {
    const before = prevById.get(customer.id);
    return (
      before !== undefined &&
      (customer.dishesServed > before.dishesServed ||
        (customer.stage === 'eating' && before.stage !== 'eating'))
    );
  });
};

/**
 * 周目状态 → BGM 轨道（design/assets.md「BGM」节）。
 * BGM-01 = Title/Menu/晨/日/夜（全游戏基础氛围）、BGM-02 = 第 20 日夜终战。
 */
export const bgmKeyForRun = (run: RunState): string =>
  run.finalBattleNight && run.phase === 'night'
    ? ASSET_KEYS.audio.bgmFinalBattle
    : ASSET_KEYS.audio.bgmInnDay;

/**
 * 迁移差分＋tap 事件 → SFX cue 列表（再生順）。
 * tap 由来の cue を先（操作への即時反馈 — P-04）、相位/差分由来を後に続ける。
 */
export function collectAudioCues(
  prev: RunState,
  next: RunState,
  tapEvent: TapEventName | null,
): readonly SfxCue[] {
  const cues: SfxCue[] = [];

  switch (tapEvent) {
    case TAP_EVENTS.OPEN_DOOR:
      // 晨→日「开门营业」（P-01 呼吸感的开场重音 = SFX-02）＋修练完成（SFX-01 升调变体）
      cues.push(cue(ASSET_KEYS.audio.sfxDoorOpen));
      if (prev.staff.some((member) => member.post === 'training')) {
        cues.push(cue(ASSET_KEYS.audio.sfxUiTap, 'trainingDone'));
      }
      break;
    case TAP_EVENTS.ASSIGN_SLOT:
      // 两次点击制的第一击（共通 UI 点击 = SFX-01 素）
      cues.push(cue(ASSET_KEYS.audio.sfxUiTap));
      break;
    case TAP_EVENTS.STAFF:
      // 第二击（指派确认/取消。变调/音量差区分场景 — assets.md SFX-01 用途）
      cues.push(cue(ASSET_KEYS.audio.sfxUiTap, 'postAssign'));
      break;
    case TAP_EVENTS.TABLE_ORDER:
      // 点单气泡亮起/派跑堂（引导视线的轻提示 = SFX-03）
      cues.push(cue(ASSET_KEYS.audio.sfxOrderBubble));
      break;
    case TAP_EVENTS.PAYMENT_BUBBLE:
      // 收银两（财线的即时兑现反馈 = SFX-05）
      cues.push(cue(ASSET_KEYS.audio.sfxCoinCollect));
      break;
    case TAP_EVENTS.EVENT_CARD_DRAW:
      // 事件卡「翻卡」（夜间仪式感 = SFX-07）
      cues.push(cue(ASSET_KEYS.audio.sfxAbacusLedger));
      break;
    case TAP_EVENTS.EVENT_CARD_OPTION:
      // 选项确定 = SFX-07 尾段纸页音变体（升调＋加速で尾段っぽい质感）
      cues.push(cue(ASSET_KEYS.audio.sfxAbacusLedger, 'cardConfirm'));
      break;
    case TAP_EVENTS.FIGHT_CONFIRM:
      // 终战「开战」确认（S-19 接线後に有効化される要求 — 先行登记）
      cues.push(cue(ASSET_KEYS.audio.sfxBattleGong));
      break;
    default:
      break;
  }

  // 日→夜迁移 = 夜间结算開始（翻帐本 = SFX-07）
  if (prev.phase === 'day' && next.phase === 'night') {
    cues.push(cue(ASSET_KEYS.audio.sfxAbacusLedger));
  }
  // 终战「开战」（第 20 日夜への进入 = SFX-08。daybreakTap 前の advanceRun 中にも成立させる）
  if (
    next.phase === 'night' &&
    next.finalBattleNight &&
    !(prev.phase === 'night' && prev.finalBattleNight)
  ) {
    cues.push(cue(ASSET_KEYS.audio.sfxBattleGong));
  }

  // 差分驱动（日间推进中の完成/离店）
  if (hasServeCompleted(prev.customers, next.customers)) {
    cues.push(cue(ASSET_KEYS.audio.sfxDishServe));
  }
  if (hasFailedDeparture(prev.customers, next.customers)) {
    cues.push(cue(ASSET_KEYS.audio.sfxFailLeave));
  }
  // 破产败局（SFX-06 低速变调 — assets.md「复用映射」）
  if (prev.ended === null && next.ended !== null && next.ended.kind === 'bankruptcy') {
    cues.push(cue(ASSET_KEYS.audio.sfxFailLeave, 'bankruptcy'));
  }

  return cues;
}
