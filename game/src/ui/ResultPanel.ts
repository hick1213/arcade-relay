/**
 * ResultPanel — 周目结果面板（S-15）。
 *
 * - 显示败局 / 周目结果标题＋总评分（gdd「总评分」单一数字化、一眼可读的大字号）
 *   ＋评分明细 4 行（银子 / 声望 / 伙计实力 / 结局加成 — 与公式输入项一一对应）。
 * - 显示值全部来自迁移载荷 RunEndSummary（Systems 层真值 — UI 不持有/累加状态，
 *   仅做显示派生）。按钮: 「再来一周目」→ GameScene 志向选择、「回到菜单」→ MenuScene。
 * - 判定区经 systems/input/InputRouter 仲裁（conventions 规则 7）。全交互为单次点击（P-04）。
 */
import Phaser from 'phaser';
import { ASSET_KEYS, GAME_HEIGHT, GAME_WIDTH, RESULT, SCORE, UI } from '../config';
import type { InputRouter } from '../systems/input/InputRouter';
import type { RunEndSummary, TapEventName, TextProvider } from '../types';
import { TAP_EVENTS } from '../types';
import { RESULT_TEXT_KEYS } from './hudStrings';
import { ensureUiPlaceholderTextures } from './placeholderTextures';
import { createUiButton, playPressFeedback } from './UiButton';

export interface ResultPanelCallbacks {
  /** 「再来一周目」→ GameScene 志向选择（不继承周目内状态） */
  readonly onRetry: () => void;
  /** 「回到菜单」→ MenuScene */
  readonly onToMenu: () => void;
}

/**
 * 总评分 = floor(silver×0.5 + rep×10 + power×20 + endingBonus)（story S-15 acceptance 的公式）。
 * 显示侧派生 — 存档侧（best_score）的权威是 S-14 metaProgression.applyRunResult，
 * 两者共用 config.SCORE 的同一常量（权重调参只动 config）。
 */
export const computeTotalScore = (summary: RunEndSummary): number =>
  Math.floor(
    summary.silver * SCORE.WEIGHT_SILVER +
      summary.reputation * SCORE.WEIGHT_REPUTATION +
      summary.staffPower * SCORE.WEIGHT_POWER +
      summary.endingBonus,
  );

/** 明细行（标签 key 与贡献值派生的对。行序 = 公式项序） */
interface BreakdownRow {
  readonly labelKey: string;
  readonly value: number;
}

const createBreakdownRows = (summary: RunEndSummary): readonly BreakdownRow[] => [
  {
    labelKey: RESULT_TEXT_KEYS.RESULT_SCORE_SILVER,
    value: summary.silver * SCORE.WEIGHT_SILVER,
  },
  {
    labelKey: RESULT_TEXT_KEYS.RESULT_SCORE_REPUTATION,
    value: summary.reputation * SCORE.WEIGHT_REPUTATION,
  },
  { labelKey: RESULT_TEXT_KEYS.RESULT_SCORE_POWER, value: summary.staffPower * SCORE.WEIGHT_POWER },
  { labelKey: RESULT_TEXT_KEYS.RESULT_SCORE_BONUS, value: summary.endingBonus },
];

/** 明细行的贡献值显示（各行为显示用的四舍五入 — 总评分本身按公式 floor） */
const formatContribution = (value: number): string => String(Math.round(value));

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
    const panel = scene.add.image(centerX, centerY, ASSET_KEYS.uiPlaceholder.resultPanel);

    const title = scene.add
      .text(
        centerX,
        centerY + RESULT.TITLE_OFFSET_Y,
        textProvider(this.titleKey(summary.kind)),
        this.titleStyle(),
      )
      .setOrigin(0.5);

    const scoreLabel = scene.add
      .text(centerX, centerY + RESULT.SCORE_LABEL_OFFSET_Y, textProvider(RESULT_TEXT_KEYS.RESULT_SCORE_LABEL), {
        fontFamily: UI.HUD_FONT_FAMILY,
        fontSize: RESULT.SCORE_LABEL_FONT_SIZE,
        color: UI.HUD_TEXT_COLOR,
        stroke: UI.HUD_STROKE_COLOR,
        strokeThickness: UI.HUD_STROKE_WIDTH,
      })
      .setOrigin(0.5);
    const scoreValue = scene.add
      .text(centerX, centerY + RESULT.SCORE_VALUE_OFFSET_Y, String(computeTotalScore(summary)), {
        fontFamily: UI.HUD_FONT_FAMILY,
        fontSize: RESULT.SCORE_VALUE_FONT_SIZE,
        fontStyle: 'bold',
        color: UI.HUD_TEXT_COLOR,
        stroke: UI.HUD_STROKE_COLOR,
        strokeThickness: UI.HUD_STROKE_WIDTH,
      })
      .setOrigin(0.5);

    const rows = createBreakdownRows(summary).map((row, index) =>
      this.createBreakdownLine(centerX, centerY, index, textProvider(row.labelKey), formatContribution(row.value)),
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
      panel,
      title,
      scoreLabel,
      scoreValue,
      ...rows.flat(),
      ...retry.visuals,
      ...toMenu.visuals,
    ]);

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

  /** 败局（破产 / 终战败）与周目完成各自的标题（gdd「胜负条件」） */
  private titleKey(kind: RunEndSummary['kind']): string {
    return kind === 'runComplete'
      ? RESULT_TEXT_KEYS.RESULT_TITLE_COMPLETE
      : RESULT_TEXT_KEYS.RESULT_TITLE_DEFEAT;
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
      fontSize: RESULT.BUTTON_FONT_SIZE,
      fontStyle: 'bold',
      color: UI.HUD_TEXT_COLOR,
      stroke: UI.HUD_STROKE_COLOR,
      strokeThickness: UI.HUD_STROKE_WIDTH,
    };
  }
}
