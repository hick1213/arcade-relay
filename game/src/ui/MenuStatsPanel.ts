/**
 * MenuStatsPanel — 「图鉴・成就・统计」3 节モーダル面板（S-26 = Menu 必需要素 2 游戏外显示完整版）。
 *
 * - 左节「结局图鉴」: 3 格（财/侠/名 — endings_seen 下标 = config.META_SAVE.ENDING_INDEX）
 *   ＋ ACH-04 进度条（图鉴完成 n/3）。
 * - 中节「成就」: ACH-01～06 达成态一览（真值 = SaveData.achievements）。
 * - 右节「统计」: 最高总评分 / 周目数 / 银子峰值 / 声望峰值 / 累计服务客数。
 * - 全部値は接线层（MenuScene create）が読んだ SaveData から描画するだけで、
 *   本组件は進行状態を持たない（ui-code: UI は受け取って描くのみ）。
 * - 未解锁/未达成項は暗褐＋中間褐色文字の可视锁定态（调色板: art-bible）で描き分け。
 * - 开启中经 InputRouter.setBlockingLayer 屏蔽基础按钮（conventions 规则 7）。
 */
import Phaser from 'phaser';
import { ASSET_KEYS, GAME_HEIGHT, GAME_WIDTH, MENU, META_SAVE, UI } from '../config';
import type { InputRouter } from '../systems/input/InputRouter';
import type { AchievementId, SaveData, TextProvider } from '../types';
import { TAP_EVENTS } from '../types';
import { MENU_TEXT_KEYS, RESULT_TEXT_KEYS } from './hudStrings';
import { ensureUiPlaceholderTextures } from './placeholderTextures';
import { createUiButton, playPressFeedback } from './UiButton';

/** 统计 5 行（label key。値は SaveData から推导 — S-13 の行キーを再利用） */
const STAT_ROW_KEYS = [
  MENU_TEXT_KEYS.MENU_STATS_BEST,
  MENU_TEXT_KEYS.MENU_STATS_RUNS,
  MENU_TEXT_KEYS.MENU_STATS_SILVER_PEAK,
  MENU_TEXT_KEYS.MENU_STATS_REP_PEAK,
  MENU_TEXT_KEYS.MENU_STATS_SERVED,
] as const;

/** 本面板の节 Column 数（SECTION_COLUMN_X_OFFSETS 的既定長。開発期に不一致を即座に検出するため） */
const SECTION_COUNT = 3;

/** 结局格 3 枚の label key（下标 = META_SAVE.ENDING_INDEX の並び: 财/侠/名 — S-25 の结局名を再利用） */
const ENDING_SLOT_LABEL_KEYS = [
  RESULT_TEXT_KEYS.RESULT_ENDING_WEALTH_TITLE,
  RESULT_TEXT_KEYS.RESULT_ENDING_XIA_TITLE,
  RESULT_TEXT_KEYS.RESULT_ENDING_FAME_TITLE,
] as const;

/** 成就 6 行の表示名（ACH-01～03 は结局名と同一定義 — 第二定義を禁止） */
const ACHIEVEMENT_LABEL_KEYS: Readonly<Record<AchievementId, string>> = {
  'ACH-01': RESULT_TEXT_KEYS.RESULT_ENDING_WEALTH_TITLE,
  'ACH-02': RESULT_TEXT_KEYS.RESULT_ENDING_XIA_TITLE,
  'ACH-03': RESULT_TEXT_KEYS.RESULT_ENDING_FAME_TITLE,
  'ACH-04': MENU_TEXT_KEYS.MENU_PANEL_ACH04_LABEL,
  'ACH-05': MENU_TEXT_KEYS.MENU_PANEL_ACH05_LABEL,
  'ACH-06': MENU_TEXT_KEYS.MENU_PANEL_ACH06_LABEL,
};

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
    const panel = scene.add.image(centerX, centerY, ASSET_KEYS.uiPlaceholder.menuFullPanel);
    const title = scene.add
      .text(
        centerX,
        centerY - MENU.FULL_PANEL_HEIGHT / 2 + MENU.FULL_PANEL_TITLE_OFFSET_Y,
        textProvider(MENU_TEXT_KEYS.MENU_STATS_TITLE),
        this.titleStyle(),
      )
      .setOrigin(0.5);

    // 列数不一致は静默的に中央堆叠させず、開發期に即座に失敗させる（CR-CODE iteration 1 指摘対応）
    const columnX = MENU.SECTION_COLUMN_X_OFFSETS.map((offset) => centerX + offset);
    if (MENU.SECTION_COLUMN_X_OFFSETS.length !== SECTION_COUNT) {
      throw new Error(
        `[MenuStatsPanel] SECTION_COLUMN_X_OFFSETS must define exactly ${SECTION_COUNT} columns (actual: ${MENU.SECTION_COLUMN_X_OFFSETS.length})`,
      );
    }
    const galleryX = columnX[0]!;
    const achievementsX = columnX[1]!;
    const statsX = columnX[2]!;

    const sectionHeaders = [MENU_TEXT_KEYS.MENU_PANEL_GALLERY_TITLE, MENU_TEXT_KEYS.MENU_PANEL_ACHIEVEMENTS_TITLE, MENU_TEXT_KEYS.MENU_PANEL_STATS_TITLE].map(
      (key, index) =>
        scene.add
          .text(columnX[index]!, MENU.SECTION_HEADER_Y, textProvider(key), this.sectionHeaderStyle())
          .setOrigin(0.5),
    );

    const galleryVisuals = this.createGallery(scene, galleryX, textProvider, save);
    const achievementRows = this.createAchievementRows(scene, achievementsX, textProvider, save);
    const statRows = this.createStatRows(scene, statsX, textProvider, save);

    const closeButton = createUiButton(
      scene,
      centerX,
      MENU.FULL_PANEL_CLOSE_Y,
      ASSET_KEYS.uiPlaceholder.menuButton,
      textProvider(MENU_TEXT_KEYS.MENU_CLOSE),
      this.buttonStyle(),
    );
    this.closeVisuals = closeButton.visuals;
    this.closeBounds = {
      x: centerX - MENU.PANEL_CLOSE_BUTTON_WIDTH / 2,
      y: MENU.FULL_PANEL_CLOSE_Y - MENU.PANEL_CLOSE_BUTTON_HEIGHT / 2,
      width: MENU.PANEL_CLOSE_BUTTON_WIDTH,
      height: MENU.PANEL_CLOSE_BUTTON_HEIGHT,
    };

    this.container.add([
      blocker,
      panel,
      title,
      ...sectionHeaders,
      ...galleryVisuals,
      ...achievementRows,
      ...statRows,
      ...closeButton.visuals,
    ]);

    router.on(TAP_EVENTS.MENU_CLOSE_PANEL, this.handleCloseTap);
  }

  /** 结局图鉴 3 格（可视锁定态: 未达成为暗褐格）＋ ACH-04 进度条（图鉴完成 n/3） */
  private createGallery(
    scene: Phaser.Scene,
    columnX: number,
    textProvider: TextProvider,
    save: SaveData,
  ): readonly Phaser.GameObjects.GameObject[] {
    const visuals: Phaser.GameObjects.GameObject[] = [];

    for (let index = 0; index < META_SAVE.ENDINGS_COUNT; index += 1) {
      const slotX = columnX + (index - (META_SAVE.ENDINGS_COUNT - 1) / 2) * MENU.SLOT_GAP;
      const unlocked = save.endings_seen[index] === true;
      const slot = scene.add
        .rectangle(
          slotX,
          MENU.SLOT_Y,
          MENU.SLOT_WIDTH,
          MENU.SLOT_HEIGHT,
          unlocked ? MENU.SLOT_FILL_UNLOCKED : MENU.SLOT_FILL_LOCKED,
          MENU.SLOT_FILL_ALPHA,
        )
        .setStrokeStyle(MENU.SLOT_STROKE_WIDTH, MENU.SLOT_STROKE);
      const label = scene.add
        .text(
          slotX,
          MENU.SLOT_Y + MENU.SLOT_LABEL_OFFSET_Y,
          // 未解锁格は结局名を伏せる（ネタバレ防止。解锁後のみ真实结局名を表示）
          textProvider(unlocked ? ENDING_SLOT_LABEL_KEYS[index] ?? '' : MENU_TEXT_KEYS.MENU_PANEL_SLOT_LOCKED),
          this.rowStyle(unlocked, MENU.SLOT_LABEL_FONT_SIZE),
        )
        .setOrigin(0.5)
        // 折返し幅 = 格中心間隔（隣接格 label の重叠防止）
        .setWordWrapWidth(MENU.SLOT_GAP);
      visuals.push(slot, label);
    }

    // ACH-04 进度（图鉴完成 n/3 — gdd「成就」表の进度显示）
    const endingsSeen = save.endings_seen.filter((seen) => seen).length;
    const progressLabel = scene.add
      .text(columnX, MENU.ACH04_LABEL_Y, textProvider(MENU_TEXT_KEYS.MENU_PANEL_ACH04_LABEL), this.ach04LabelStyle())
      .setOrigin(0.5);
    const progressComplete = endingsSeen >= META_SAVE.ENDINGS_COUNT;
    const barTrack = scene.add
      .rectangle(columnX, MENU.ACH04_BAR_Y, MENU.ACH04_BAR_WIDTH, MENU.ACH04_BAR_HEIGHT, MENU.SLOT_FILL_LOCKED, MENU.SLOT_FILL_ALPHA)
      .setStrokeStyle(MENU.SLOT_STROKE_WIDTH, MENU.SLOT_STROKE);
    const barFill = scene.add.rectangle(
      columnX - MENU.ACH04_BAR_WIDTH / 2,
      MENU.ACH04_BAR_Y,
      MENU.ACH04_BAR_WIDTH * (endingsSeen / META_SAVE.ENDINGS_COUNT),
      MENU.ACH04_BAR_HEIGHT,
      MENU.SLOT_FILL_UNLOCKED,
      MENU.SLOT_FILL_ALPHA,
    ).setOrigin(0, 0.5);
    const progressValue = scene.add
      .text(
        columnX + MENU.ACH04_BAR_WIDTH / 2 + MENU.ACH04_VALUE_X_GAP,
        MENU.ACH04_BAR_Y,
        `${endingsSeen} / ${META_SAVE.ENDINGS_COUNT}`,
        this.rowStyle(progressComplete, MENU.ACH04_VALUE_FONT_SIZE),
      )
      .setOrigin(0, 0.5);
    visuals.push(progressLabel, barTrack, barFill, progressValue);

    return visuals;
  }

  /** 成就一览 6 行（ACH-01～06。达成=金色「达成」/ 未达成=褐「未达成」の可视锁定态） */
  private createAchievementRows(
    scene: Phaser.Scene,
    columnX: number,
    textProvider: TextProvider,
    save: SaveData,
  ): readonly Phaser.GameObjects.GameObject[] {
    const visuals: Phaser.GameObjects.GameObject[] = [];

    META_SAVE.ACHIEVEMENT_IDS.forEach((id, index) => {
      const achieved = save.achievements[id] === true;
      const y = MENU.ROW_START_Y + index * MENU.ROW_GAP;
      const name = scene.add
        .text(columnX + MENU.ACH_NAME_X_OFFSET, y, `${id} ${textProvider(ACHIEVEMENT_LABEL_KEYS[id] ?? '')}`, this.rowStyle(achieved))
        .setOrigin(0, 0.5);
      const state = scene.add
        .text(
          columnX + MENU.ACH_STATE_X_OFFSET,
          y,
          textProvider(achieved ? MENU_TEXT_KEYS.MENU_PANEL_ACH_DONE : MENU_TEXT_KEYS.MENU_PANEL_ACH_LOCKED),
          this.rowStyle(achieved),
        )
        .setOrigin(1, 0.5);
      visuals.push(name, state);
    });

    return visuals;
  }

  /** 统计 5 行（全て SaveData から推导 — UI 側に状态コピーを持たない） */
  private createStatRows(
    scene: Phaser.Scene,
    columnX: number,
    textProvider: TextProvider,
    save: SaveData,
  ): readonly Phaser.GameObjects.GameObject[] {
    const visuals: Phaser.GameObjects.GameObject[] = [];
    const values: readonly string[] = [
      `${save.best_score}`,
      `${save.stats.finished_runs}`,
      `${save.stats.silver_peak}`,
      `${save.stats.rep_peak}`,
      `${save.stats.served_total}`,
    ];

    STAT_ROW_KEYS.forEach((key, index) => {
      const y = MENU.ROW_START_Y + index * MENU.ROW_GAP;
      const label = scene.add
        .text(columnX + MENU.STATS_LABEL_X_OFFSET, y, textProvider(key), this.rowStyle(true))
        .setOrigin(0, 0.5);
      const value = scene.add
        .text(columnX + MENU.STATS_VALUE_X_OFFSET, y, values[index] ?? '', this.rowStyle(true))
        .setOrigin(1, 0.5);
      visuals.push(label, value);
    });

    return visuals;
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
      fontSize: MENU.FULL_PANEL_TITLE_FONT_SIZE,
      fontStyle: 'bold',
      color: UI.HUD_TEXT_COLOR,
      stroke: UI.HUD_STROKE_COLOR,
      strokeThickness: UI.HUD_STROKE_WIDTH,
    };
  }

  private sectionHeaderStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: UI.HUD_FONT_FAMILY,
      resolution: UI.TEXT_RESOLUTION,
      fontSize: MENU.SECTION_HEADER_FONT_SIZE,
      fontStyle: 'bold',
      color: UI.HUD_TEXT_COLOR,
      stroke: UI.HUD_STROKE_COLOR,
      strokeThickness: UI.HUD_STROKE_WIDTH,
    };
  }

  /** 行/格 label 共通样式（achieved=true → 金文字 / false → 褐色の可视锁定态。fontSize は既定 ROW_FONT_SIZE を呼び出し側で上書き可） */
  private rowStyle(achieved: boolean, fontSize: string = MENU.ROW_FONT_SIZE): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: UI.HUD_FONT_FAMILY,
      resolution: UI.TEXT_RESOLUTION,
      fontSize,
      color: achieved ? MENU.UNLOCKED_TEXT_COLOR : MENU.LOCKED_TEXT_COLOR,
      stroke: UI.HUD_STROKE_COLOR,
      strokeThickness: UI.HUD_STROKE_WIDTH,
    };
  }

  private ach04LabelStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: UI.HUD_FONT_FAMILY,
      resolution: UI.TEXT_RESOLUTION,
      fontSize: MENU.ACH04_LABEL_FONT_SIZE,
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
