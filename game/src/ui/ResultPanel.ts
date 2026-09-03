/**
 * ResultPanel — 周目结果面板（S-15 基础 + S-25 结局演出完整版）。
 *
 * - 结局演出（S-25 acceptance）:
 *   - 周目完成＋结局（S-20 判定 → RunEndSummary.ending）: 结局插画（IMG-26～28 —
 *     画面全覆盖 cover 拡縮）＋结局标题/结局文（i18n）。
 *   - 破产败局: 专属标题/败局文＋「账本合上」演出（面板中央で帳簿が閉じ、SFX-07 と共に
 *     フェードアウトして评分を顕す）。
 *   - 终战败: 专属标题/败局文＋朱 flash 演出（SFX-08 を场景接线層で再生）。
 *   - 新纪录（totalScore > bestScoreBefore。finalBattleLoss は persist 不発のため非対象）:
 *     总评分の右侧に「★ 新纪录」标记（脉动闪烁）。
 * - 总评分细目: 三线数值×权重→贡献（gdd「总评分」公式。权重は config.SCORE —
 *   存档侧 computeRunScore と同一常量）を 4 行で表示。
 * - 显示值全部来自迁移载荷 RunEndSummary（Systems 层真值 — UI 不持有/累加状态）。
 * - 判定区经 systems/input/InputRouter 仲裁（conventions 规则 7）。全交互为单次点击（P-04）。
 */
import Phaser from 'phaser';
import { ASSET_KEYS, GAME_HEIGHT, GAME_WIDTH, GAMEPLAY, RESULT, SCORE, UI } from '../config';
import type { InputRouter } from '../systems/input/InputRouter';
import type { AmbitionId, RunEndSummary, TapEventName, TextProvider } from '../types';
import { TAP_EVENTS } from '../types';
import { RESULT_TEXT_KEYS } from './hudStrings';
import { ensureUiPlaceholderTextures } from './placeholderTextures';
import { createUiButton, playPressFeedback } from './UiButton';

export interface ResultPanelCallbacks {
  /** 「再来一周目」→ GameScene 志向选择（不继承周目内状态） */
  readonly onRetry: () => void;
  /** 「回到菜单」→ MenuScene */
  readonly onToMenu: () => void;
  /** 账本合上の瞬间（破产演出 — SFX-07 を场景接线層で再生） */
  readonly onLedgerClosed?: () => void;
  /** 终战败演出の開始瞬间（SFX-08 を场景接线層で再生） */
  readonly onDefeatSting?: () => void;
}

/**
 * 总评分 = floor(silver×0.5 + rep×10 + power×20 + endingBonus)（story S-15 acceptance 的公式）。
 * 显示侧派生 — 存档侧（best_score）的权威是 metaProgression.applyRunResult，
 * 两者共用 config.SCORE 的同一常量（权重调参只动 config）。
 */
export const computeTotalScore = (summary: RunEndSummary): number =>
  Math.floor(
    summary.silver * SCORE.WEIGHT_SILVER +
      summary.reputation * SCORE.WEIGHT_REPUTATION +
      summary.staffPower * SCORE.WEIGHT_POWER +
      summary.endingBonus,
  );

/** 明细行（标签 key ＋ 三线数值×权重→贡献。行序 = 公式项序。weight = null は结局加成行） */
interface BreakdownRow {
  readonly labelKey: string;
  readonly raw: number;
  readonly weight: number | null;
  readonly contribution: number;
}

const createBreakdownRows = (summary: RunEndSummary): readonly BreakdownRow[] => [
  {
    labelKey: RESULT_TEXT_KEYS.RESULT_SCORE_SILVER,
    raw: summary.silver,
    weight: SCORE.WEIGHT_SILVER,
    contribution: summary.silver * SCORE.WEIGHT_SILVER,
  },
  {
    labelKey: RESULT_TEXT_KEYS.RESULT_SCORE_REPUTATION,
    raw: summary.reputation,
    weight: SCORE.WEIGHT_REPUTATION,
    contribution: summary.reputation * SCORE.WEIGHT_REPUTATION,
  },
  {
    labelKey: RESULT_TEXT_KEYS.RESULT_SCORE_POWER,
    raw: summary.staffPower,
    weight: SCORE.WEIGHT_POWER,
    contribution: summary.staffPower * SCORE.WEIGHT_POWER,
  },
  {
    labelKey: RESULT_TEXT_KEYS.RESULT_SCORE_BONUS,
    raw: summary.endingBonus,
    weight: null,
    contribution: summary.endingBonus,
  },
];

/** 明细行的值表示（三线数值×权重→贡献。行は显示用の四舍五入 — 总评分本身按公式 floor） */
const formatBreakdown = (row: BreakdownRow): string =>
  row.weight === null
    ? `+${Math.round(row.contribution)}`
    : `${Math.round(row.raw)} × ${row.weight} → ${Math.round(row.contribution)}`;

/** 新纪录（S-25）: persist 基準値を上回った周目终了のみ。终战败は persist 不発のため非対象 */
const isNewRecord = (summary: RunEndSummary): boolean =>
  summary.kind !== 'finalBattleLoss' &&
  summary.bestScoreBefore !== undefined &&
  computeTotalScore(summary) > summary.bestScoreBefore;

/** 结局 id → 结局标题/结局文/插画 key の対応（插画は RESULT.ENDING_IMAGE — ASSET_KEYS 参照） */
const ENDING_PRESENTATION: Readonly<
  Record<AmbitionId, { readonly titleKey: string; readonly bodyKey: string }>
> = {
  wealth: {
    titleKey: RESULT_TEXT_KEYS.RESULT_ENDING_WEALTH_TITLE,
    bodyKey: RESULT_TEXT_KEYS.RESULT_ENDING_WEALTH_BODY,
  },
  xia: {
    titleKey: RESULT_TEXT_KEYS.RESULT_ENDING_XIA_TITLE,
    bodyKey: RESULT_TEXT_KEYS.RESULT_ENDING_XIA_BODY,
  },
  fame: {
    titleKey: RESULT_TEXT_KEYS.RESULT_ENDING_FAME_TITLE,
    bodyKey: RESULT_TEXT_KEYS.RESULT_ENDING_FAME_BODY,
  },
};

interface ResultButton {
  readonly event: TapEventName;
  readonly visuals: readonly Phaser.GameObjects.GameObject[];
}

export class ResultPanel {
  private readonly scene: Phaser.Scene;
  private readonly router: InputRouter;
  private readonly callbacks: ResultPanelCallbacks;
  private readonly buttons: readonly ResultButton[];

  constructor(
    scene: Phaser.Scene,
    textProvider: TextProvider,
    router: InputRouter,
    summary: RunEndSummary,
    callbacks: ResultPanelCallbacks,
  ) {
    this.scene = scene;
    this.router = router;
    this.callbacks = callbacks;
    ensureUiPlaceholderTextures(scene);

    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    // 结局插画（IMG-26～28）＋变暗遮罩（结局文・评分の可読性確保 — S-25）
    const endingBackdrop = this.createEndingBackdrop(summary, centerX, centerY);

    const panel = scene.add.image(centerX, centerY, ASSET_KEYS.uiPlaceholder.resultPanel);
    const title = scene.add
      .text(centerX, centerY + RESULT.TITLE_OFFSET_Y, textProvider(this.titleKey(summary)), this.titleStyle())
      .setOrigin(0.5);
    const body = this.createBodyText(summary, textProvider, centerX, centerY);

    const scoreLabel = scene.add
      .text(centerX, centerY + RESULT.SCORE_LABEL_OFFSET_Y, textProvider(RESULT_TEXT_KEYS.RESULT_SCORE_LABEL), {
        fontFamily: UI.HUD_FONT_FAMILY,
        resolution: UI.TEXT_RESOLUTION,
        fontSize: RESULT.SCORE_LABEL_FONT_SIZE,
        color: UI.HUD_TEXT_COLOR,
        stroke: UI.HUD_STROKE_COLOR,
        strokeThickness: UI.HUD_STROKE_WIDTH,
      })
      .setOrigin(0.5);
    const scoreValue = scene.add
      .text(centerX, centerY + RESULT.SCORE_VALUE_OFFSET_Y, String(computeTotalScore(summary)), {
        fontFamily: UI.HUD_FONT_FAMILY,
        resolution: UI.TEXT_RESOLUTION,
        fontSize: RESULT.SCORE_VALUE_FONT_SIZE,
        fontStyle: 'bold',
        color: UI.HUD_TEXT_COLOR,
        stroke: UI.HUD_STROKE_COLOR,
        strokeThickness: UI.HUD_STROKE_WIDTH,
      })
      .setOrigin(0.5);
    const newRecordBadge = isNewRecord(summary)
      ? this.createNewRecordBadge(textProvider, centerX, centerY + RESULT.SCORE_VALUE_OFFSET_Y)
      : null;

    const rows = createBreakdownRows(summary).map((row, index) =>
      this.createBreakdownLine(centerX, centerY, index, textProvider(row.labelKey), formatBreakdown(row)),
    );

    const retry = this.createButton(
      centerX - RESULT.BUTTON_WIDTH / 2 - RESULT.BUTTON_GAP / 2,
      centerY + RESULT.BUTTONS_OFFSET_Y,
      RESULT.ZONE_RETRY,
      TAP_EVENTS.RESULT_RETRY,
      textProvider(RESULT_TEXT_KEYS.RESULT_RETRY),
    );
    const toMenu = this.createButton(
      centerX + RESULT.BUTTON_WIDTH / 2 + RESULT.BUTTON_GAP / 2,
      centerY + RESULT.BUTTONS_OFFSET_Y,
      RESULT.ZONE_TO_MENU,
      TAP_EVENTS.RESULT_TO_MENU,
      textProvider(RESULT_TEXT_KEYS.RESULT_TO_MENU),
    );
    this.buttons = [retry, toMenu];

    scene.add.container(0, 0, [
      ...endingBackdrop,
      panel,
      title,
      ...body,
      scoreLabel,
      scoreValue,
      ...(newRecordBadge ? [newRecordBadge] : []),
      ...rows.flat(),
      ...retry.visuals,
      ...toMenu.visuals,
    ]);

    // 败局演出（S-25: 破产=账本合上 / 终战败=朱 flash）。演出は输入を妨げない（按钮は即押せる）
    this.playDefeatPresentation(summary, centerX, centerY);

    router.on(TAP_EVENTS.RESULT_RETRY, this.handleRetryTap);
    router.on(TAP_EVENTS.RESULT_TO_MENU, this.handleToMenuTap);
  }

  private readonly handleRetryTap = (): void => {
    playPressFeedback(this.scene, this.visualsFor(TAP_EVENTS.RESULT_RETRY));
    this.callbacks.onRetry();
  };

  private readonly handleToMenuTap = (): void => {
    playPressFeedback(this.scene, this.visualsFor(TAP_EVENTS.RESULT_TO_MENU));
    this.callbacks.onToMenu();
  };

  private visualsFor(event: TapEventName): readonly Phaser.GameObjects.GameObject[] {
    return this.buttons.find((button) => button.event === event)?.visuals ?? [];
  }

  /** 结局插画（IMG-26～28）: runComplete＋结局确定（S-20 判定値）时のみ。画面全覆盖 cover 拡縮 */
  private createEndingBackdrop(
    summary: RunEndSummary,
    centerX: number,
    centerY: number,
  ): readonly Phaser.GameObjects.GameObject[] {
    if (summary.kind !== 'runComplete' || summary.ending == null) {
      return [];
    }
    const image = this.scene.add.image(centerX, centerY, RESULT.ENDING_IMAGE[summary.ending]);
    // cover 拡縮: 比率はテクスチャ実寸から導出（画面外に出る分は見切れ — 直書きサイズなし）
    image.setScale(Math.max(GAME_WIDTH / image.width, GAME_HEIGHT / image.height));
    const overlay = this.scene.add
      .rectangle(centerX, centerY, GAME_WIDTH, GAME_HEIGHT, UI.BLOCKER_COLOR, RESULT.ENDING_OVERLAY_ALPHA);
    return [image, overlay];
  }

  /** 标题（结局/败局种类別 — gdd「胜负条件」＋ S-25 专属文案） */
  private titleKey(summary: RunEndSummary): string {
    switch (summary.kind) {
      case 'bankruptcy':
        return RESULT_TEXT_KEYS.RESULT_TITLE_BANKRUPTCY;
      case 'finalBattleLoss':
        return RESULT_TEXT_KEYS.RESULT_TITLE_FINAL_LOSS;
      case 'runComplete':
        return summary.ending != null
          ? ENDING_PRESENTATION[summary.ending].titleKey
          : RESULT_TEXT_KEYS.RESULT_TITLE_COMPLETE;
    }
  }

  /** 结局文/败局文（标题下 1〜2 行。runComplete 且结局未确定时は表示なし） */
  private createBodyText(
    summary: RunEndSummary,
    textProvider: TextProvider,
    centerX: number,
    centerY: number,
  ): readonly Phaser.GameObjects.Text[] {
    const bodyKey = this.bodyKey(summary);
    if (bodyKey === null) {
      return [];
    }
    const text = this.scene.add
      .text(centerX, centerY + RESULT.BODY_OFFSET_Y, textProvider(bodyKey), {
        fontFamily: UI.HUD_FONT_FAMILY,
        resolution: UI.TEXT_RESOLUTION,
        fontSize: RESULT.BODY_FONT_SIZE,
        color: UI.HUD_TEXT_COLOR,
        stroke: UI.HUD_STROKE_COLOR,
        strokeThickness: UI.HUD_STROKE_WIDTH,
        wordWrap: { width: RESULT.BODY_WRAP_WIDTH },
        align: 'center',
      })
      .setOrigin(0.5, 0);
    return [text];
  }

  private bodyKey(summary: RunEndSummary): string | null {
    switch (summary.kind) {
      case 'bankruptcy':
        return RESULT_TEXT_KEYS.RESULT_BODY_BANKRUPTCY;
      case 'finalBattleLoss':
        return RESULT_TEXT_KEYS.RESULT_BODY_FINAL_LOSS;
      case 'runComplete':
        return summary.ending != null ? ENDING_PRESENTATION[summary.ending].bodyKey : null;
    }
  }

  /** 「★ 新纪录」标记（总评分值の右侧。脉动闪烁 — delta-driven clock の tween。文案は i18n key） */
  private createNewRecordBadge(
    textProvider: TextProvider,
    scoreX: number,
    scoreY: number,
  ): Phaser.GameObjects.Text {
    const badge = this.scene.add
      .text(scoreX + RESULT.NEW_RECORD_X_OFFSET, scoreY, textProvider(RESULT_TEXT_KEYS.RESULT_NEW_RECORD), {
        fontFamily: UI.HUD_FONT_FAMILY,
        resolution: UI.TEXT_RESOLUTION,
        fontSize: RESULT.NEW_RECORD_FONT_SIZE,
        color: UI.HUD_VALUE_COLOR,
        stroke: UI.HUD_STROKE_COLOR,
        strokeThickness: UI.HUD_STROKE_WIDTH,
      })
      .setOrigin(0.5);
    this.scene.tweens.add({
      targets: badge,
      alpha: RESULT.NEW_RECORD_ALPHA_MIN,
      duration: RESULT.NEW_RECORD_PULSE_MS,
      yoyo: true,
      repeat: -1,
    });
    return badge;
  }

  /** 败局演出の分岐（S-25。演出は既存パネル内容の上に重なる — 非破坏・入力不妨碍） */
  private playDefeatPresentation(summary: RunEndSummary, centerX: number, centerY: number): void {
    if (summary.kind === 'bankruptcy') {
      this.playLedgerClosing(centerX, centerY);
      return;
    }
    if (summary.kind === 'finalBattleLoss') {
      this.playDefeatFlash();
      this.callbacks.onDefeatSting?.();
    }
  }

  /** 破产演出「账本合上」: 右表紙が閉じる → SFX → 一拍 → フェードアウト（评分を顕す） */
  private playLedgerClosing(centerX: number, centerY: number): void {
    const halfWidth = RESULT.LEDGER_WIDTH / 2;
    const spineX = centerX - halfWidth;
    const page = this.scene.add
      .rectangle(centerX, centerY, RESULT.LEDGER_WIDTH - RESULT.LEDGER_SPINE_INSET * 2, RESULT.LEDGER_HEIGHT - RESULT.LEDGER_SPINE_INSET * 2, RESULT.LEDGER_PAGE_FILL, RESULT.LEDGER_PAGE_ALPHA);
    const leftCover = this.scene.add
      .rectangle(spineX + halfWidth / 2, centerY, halfWidth, RESULT.LEDGER_HEIGHT, RESULT.LEDGER_COVER_FILL)
      .setStrokeStyle(RESULT.LEDGER_COVER_STROKE_WIDTH, RESULT.LEDGER_COVER_STROKE);
    const rightCover = this.scene.add
      .rectangle(spineX, centerY, halfWidth, RESULT.LEDGER_HEIGHT, RESULT.LEDGER_COVER_FILL)
      .setStrokeStyle(RESULT.LEDGER_COVER_STROKE_WIDTH, RESULT.LEDGER_COVER_STROKE)
      .setOrigin(0, 0.5)
      .setAngle(-RESULT.LEDGER_OPEN_ANGLE);
    const spine = this.scene.add.rectangle(spineX, centerY, RESULT.LEDGER_SPINE_INSET, RESULT.LEDGER_HEIGHT, UI.PANEL_STROKE);
    // 子は絶対座標で配置済み — コンテナはオフセットなし（子座標 = 画面座標）
    const ledger = this.scene.add.container(0, 0, [page, leftCover, rightCover, spine]);
    ledger.setDepth(UI.DEPTH_PAUSE);

    this.scene.tweens.add({
      targets: rightCover,
      angle: 0,
      duration: RESULT.LEDGER_CLOSE_MS,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.callbacks.onLedgerClosed?.();
        this.scene.tweens.add({
          targets: ledger,
          alpha: 0,
          delay: RESULT.LEDGER_HOLD_MS,
          duration: RESULT.LEDGER_FADE_MS,
          onComplete: () => ledger.destroy(),
        });
      },
    });
  }

  /** 终战败演出: 画面全体への朱 flash（短時間で消灯 — 判断を妨げない） */
  private playDefeatFlash(): void {
    const flash = this.scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, GAMEPLAY.STAFF_FILL, RESULT.DEFEAT_FLASH_ALPHA)
      .setDepth(UI.DEPTH_PAUSE);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: RESULT.DEFEAT_FLASH_MS,
      onComplete: () => flash.destroy(),
    });
  }

  private createBreakdownLine(
    centerX: number,
    centerY: number,
    index: number,
    labelText: string,
    valueText: string,
  ): Phaser.GameObjects.Text[] {
    const y = centerY + RESULT.BREAKDOWN_START_OFFSET_Y + index * RESULT.BREAKDOWN_LINE_GAP;
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: UI.HUD_FONT_FAMILY,
      resolution: UI.TEXT_RESOLUTION,
      fontSize: RESULT.BREAKDOWN_FONT_SIZE,
      color: UI.HUD_TEXT_COLOR,
      stroke: UI.HUD_STROKE_COLOR,
      strokeThickness: UI.HUD_STROKE_WIDTH,
    };
    const label = this.scene.add
      .text(centerX + RESULT.BREAKDOWN_LABEL_X_OFFSET, y, labelText, style)
      .setOrigin(0, 0.5);
    const value = this.scene.add
      .text(centerX + RESULT.BREAKDOWN_VALUE_X_OFFSET, y, valueText, style)
      .setOrigin(1, 0.5);
    return [label, value];
  }

  private createButton(
    centerX: number,
    centerY: number,
    zoneId: string,
    event: TapEventName,
    labelText: string,
  ): ResultButton {
    const button = createUiButton(
      this.scene,
      centerX,
      centerY,
      ASSET_KEYS.uiPlaceholder.pauseButton,
      labelText,
      this.buttonStyle(),
    );
    this.router.registerZone({
      id: zoneId,
      bounds: {
        x: centerX - RESULT.BUTTON_WIDTH / 2,
        y: centerY - RESULT.BUTTON_HEIGHT / 2,
        width: RESULT.BUTTON_WIDTH,
        height: RESULT.BUTTON_HEIGHT,
      },
      priority: RESULT.PRIORITY_BUTTON,
      event,
    });
    return { event, visuals: button.visuals };
  }

  private titleStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: UI.HUD_FONT_FAMILY,
      resolution: UI.TEXT_RESOLUTION,
      fontSize: RESULT.TITLE_FONT_SIZE,
      fontStyle: 'bold',
      color: UI.HUD_TEXT_COLOR,
      stroke: UI.HUD_STROKE_COLOR,
      strokeThickness: UI.HUD_STROKE_WIDTH,
    };
  }

  private buttonStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: UI.HUD_FONT_FAMILY,
      resolution: UI.TEXT_RESOLUTION,
      fontSize: RESULT.BUTTON_FONT_SIZE,
      fontStyle: 'bold',
      color: UI.HUD_TEXT_COLOR,
      stroke: UI.HUD_STROKE_COLOR,
      strokeThickness: UI.HUD_STROKE_WIDTH,
    };
  }
}
