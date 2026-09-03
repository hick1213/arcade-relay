/**
 * MenuStatsPanel — 「图鉴・统计」模态面板（S-13 游戏外显示 = Menu 必需要素 2）。
 *
 * - 显示 SaveData 的元进度: 最高总评分 / 周目数 / 银子・声望峰值 / 累计服务客数 / 结局图鉴。
 *   真值 = SaveData（接线层在 MenuScene create 时读取），本组件只接收并绘制。
 * - 开启中经 InputRouter.setBlockingLayer 屏蔽基础按钮（conventions 规则 7），
 *   关闭按钮判定区仅开启期间注册。
 */
import Phaser from 'phaser';
import { ASSET_KEYS, GAME_HEIGHT, GAME_WIDTH, MENU, UI } from '../config';
import type { InputRouter } from '../systems/input/InputRouter';
import type { SaveData, TextProvider } from '../types';
import { TAP_EVENTS } from '../types';
import { MENU_TEXT_KEYS } from './hudStrings';
import { ensureUiPlaceholderTextures } from './placeholderTextures';
import { createUiButton, playPressFeedback } from './UiButton';

const STAT_LINE_KEYS = [
  MENU_TEXT_KEYS.MENU_STATS_BEST,
  MENU_TEXT_KEYS.MENU_STATS_RUNS,
  MENU_TEXT_KEYS.MENU_STATS_SILVER_PEAK,
  MENU_TEXT_KEYS.MENU_STATS_REP_PEAK,
  MENU_TEXT_KEYS.MENU_STATS_SERVED,
  MENU_TEXT_KEYS.MENU_STATS_ENDINGS,
] as const;

export class MenuStatsPanel {
  readonly container: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private readonly router: InputRouter;
  private readonly closeBounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  private readonly closeVisuals: readonly Phaser.GameObjects.GameObject[];
  private opened = false;

  constructor(scene: Phaser.Scene, textProvider: TextProvider, router: InputRouter, save: SaveData) {
    this.scene = scene;
    this.router = router;
    ensureUiPlaceholderTextures(scene);

    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;
    this.container = scene.add.container(0, 0).setDepth(MENU.DEPTH_MODAL).setVisible(false);

    const blocker = scene.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, UI.BLOCKER_COLOR, UI.BLOCKER_ALPHA)
      .setOrigin(0, 0);
    const panel = scene.add.image(centerX, centerY, ASSET_KEYS.uiPlaceholder.menuPanel);
    const title = scene.add
      .text(
        centerX,
        centerY - MENU.PANEL_HEIGHT / 2 + MENU.PANEL_TITLE_OFFSET_Y,
        textProvider(MENU_TEXT_KEYS.MENU_STATS_TITLE),
        this.titleStyle(),
      )
      .setOrigin(0.5);

    const endingsSeen = save.endings_seen.filter((seen) => seen).length;
    const values: readonly string[] = [
      `${save.best_score}`,
      `${save.stats.finished_runs}`,
      `${save.stats.silver_peak}`,
      `${save.stats.rep_peak}`,
      `${save.stats.served_total}`,
      `${endingsSeen} / ${save.endings_seen.length}`,
    ];

    const lines = STAT_LINE_KEYS.map((key, index) => {
      const y = MENU.PANEL_LINE_START_Y + index * MENU.PANEL_LINE_GAP;
      const labelText = scene.add
        .text(centerX + MENU.PANEL_LINE_LABEL_X_OFFSET, y, textProvider(key), this.lineStyle())
        .setOrigin(0, 0.5);
      const valueText = scene.add
        .text(centerX + MENU.PANEL_LINE_VALUE_X_OFFSET, y, values[index] ?? '', this.lineStyle())
        .setOrigin(1, 0.5);
      return [labelText, valueText] as const;
    });

    const closeButton = createUiButton(
      scene,
      centerX,
      MENU.PANEL_CLOSE_BUTTON_Y,
      ASSET_KEYS.uiPlaceholder.menuButton,
      textProvider(MENU_TEXT_KEYS.MENU_CLOSE),
      this.buttonStyle(),
    );
    this.closeVisuals = closeButton.visuals;
    this.closeBounds = {
      x: centerX - MENU.PANEL_CLOSE_BUTTON_WIDTH / 2,
      y: MENU.PANEL_CLOSE_BUTTON_Y - MENU.PANEL_CLOSE_BUTTON_HEIGHT / 2,
      width: MENU.PANEL_CLOSE_BUTTON_WIDTH,
      height: MENU.PANEL_CLOSE_BUTTON_HEIGHT,
    };

    this.container.add([
      blocker,
      panel,
      title,
      ...lines.flat(),
      ...closeButton.visuals,
    ]);

    router.on(TAP_EVENTS.MENU_CLOSE_PANEL, this.handleCloseTap);
  }

  open(): void {
    if (this.opened) {
      return;
    }
    this.opened = true;
    this.container.setVisible(true);
    this.router.registerZone({
      id: MENU.ZONE_STATS_CLOSE,
      bounds: this.closeBounds,
      priority: MENU.PRIORITY_MODAL,
      event: TAP_EVENTS.MENU_CLOSE_PANEL,
      layer: MENU.LAYER_ID,
    });
    this.router.setBlockingLayer(MENU.LAYER_ID);
  }

  close(): void {
    if (!this.opened) {
      return;
    }
    this.opened = false;
    this.container.setVisible(false);
    this.router.unregisterZone(MENU.ZONE_STATS_CLOSE);
    this.router.setBlockingLayer(null);
  }

  private readonly handleCloseTap = (): void => {
    playPressFeedback(this.scene, this.closeVisuals);
    this.close();
  };

  private titleStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: UI.HUD_FONT_FAMILY,
      resolution: UI.TEXT_RESOLUTION,
      fontSize: MENU.PANEL_TITLE_FONT_SIZE,
      fontStyle: 'bold',
      color: UI.HUD_TEXT_COLOR,
      stroke: UI.HUD_STROKE_COLOR,
      strokeThickness: UI.HUD_STROKE_WIDTH,
    };
  }

  private lineStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: UI.HUD_FONT_FAMILY,
      resolution: UI.TEXT_RESOLUTION,
      fontSize: MENU.PANEL_LINE_FONT_SIZE,
      color: UI.HUD_TEXT_COLOR,
      stroke: UI.HUD_STROKE_COLOR,
      strokeThickness: UI.HUD_STROKE_WIDTH,
    };
  }

  private buttonStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: UI.HUD_FONT_FAMILY,
      resolution: UI.TEXT_RESOLUTION,
      fontSize: MENU.PANEL_CLOSE_BUTTON_FONT_SIZE,
      fontStyle: 'bold',
      color: UI.HUD_TEXT_COLOR,
      stroke: UI.HUD_STROKE_COLOR,
      strokeThickness: UI.HUD_STROKE_WIDTH,
    };
  }
}
