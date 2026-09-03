/**
 * PausePanel — 「帐本」按钮打开的暂停面板（S-10）。
 *
 * - 显示「继续 / 回到菜单」两个大按钮（≥ BUTTON_MIN_SIZE_PX）＋画面中央模态面板。
 * - 开启中经 InputRouter.setBlockingLayer 屏蔽非本层判定区（gdd: 暂停面板优先级最高、
 *   面板开启时屏蔽其他点击 — 仲裁在 input 层，conventions 规则 7）。
 * - Scene 侧在 update 中以 isOpen 为守卫停止相位推进（日间硬计时暂停）。
 * - 判定区仅在开启期间注册（关闭中的不可见按钮不可点击）。
 */
import Phaser from 'phaser';
import { ASSET_KEYS, GAME_HEIGHT, GAME_WIDTH, INPUT_PRIORITY, UI } from '../config';
import type { InputRouter } from '../systems/input/InputRouter';
import { TAP_EVENTS, type Rect, type TapEventName, type TextProvider } from '../types';
import { HUD_TEXT_KEYS } from './hudStrings';
import { ensureUiPlaceholderTextures } from './placeholderTextures';
import { createUiButton, playPressFeedback } from './UiButton';

export interface PausePanelCallbacks {
  /** 「结束周目」→ GameScene 迁移到 ResultScene（prototype 临时経路 — S-03/S-08 接线后
   *  由破产/终战判定的自动迁移置換，本按钮届时移除。QA 必需场景循环 Title→…→Result 的
   *  Game→Result 经由此按钮以实际操作走通） */
  readonly onEndRun: () => void;
  /** 「回到菜单」→ GameScene 迁移到 MenuScene */
  readonly onQuitToMenu: () => void;
}

interface PanelButton {
  readonly zoneId: string;
  readonly event: TapEventName;
  readonly bounds: Rect;
  readonly visuals: readonly Phaser.GameObjects.GameObject[];
}

export class PausePanel {
  readonly container: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private readonly router: InputRouter;
  private readonly callbacks: PausePanelCallbacks;
  private readonly buttons: readonly PanelButton[];
  private opened = false;

  constructor(
    scene: Phaser.Scene,
    textProvider: TextProvider,
    router: InputRouter,
    callbacks: PausePanelCallbacks,
  ) {
    this.scene = scene;
    this.router = router;
    this.callbacks = callbacks;
    ensureUiPlaceholderTextures(scene);
    this.container = scene.add.container(0, 0).setDepth(UI.DEPTH_PAUSE).setVisible(false);

    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;
    const blocker = scene.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, UI.BLOCKER_COLOR, UI.BLOCKER_ALPHA)
      .setOrigin(0, 0);
    const panel = scene.add.image(centerX, centerY, ASSET_KEYS.uiPlaceholder.pausePanel);
    const title = scene.add
      .text(
        centerX,
        centerY - UI.PAUSE_PANEL_HEIGHT / 2 + UI.PAUSE_TITLE_OFFSET_Y,
        textProvider(HUD_TEXT_KEYS.PAUSE_TITLE),
        this.titleStyle(),
      )
      .setOrigin(0.5);

    // 纵向堆叠（3 按钮: 继续 / 结束周目 / 回到菜单 — 位置由 config 的间隔常量推导）
    const definitions = [
      {
        zoneId: UI.ZONE_PAUSE_RESUME,
        event: TAP_EVENTS.PAUSE_RESUME,
        labelKey: HUD_TEXT_KEYS.PAUSE_RESUME,
      },
      {
        zoneId: UI.ZONE_PAUSE_END_RUN,
        event: TAP_EVENTS.PAUSE_END_RUN,
        labelKey: HUD_TEXT_KEYS.PAUSE_END_RUN,
      },
      {
        zoneId: UI.ZONE_PAUSE_MENU,
        event: TAP_EVENTS.PAUSE_TO_MENU,
        labelKey: HUD_TEXT_KEYS.PAUSE_QUIT,
      },
    ] as const;
    const buttons = definitions.map((definition, index) =>
      this.createButton(
        centerX,
        centerY + (index - (definitions.length - 1) / 2) * UI.PAUSE_BUTTON_STACK_GAP,
        definition.zoneId,
        definition.event,
        textProvider(definition.labelKey),
      ),
    );
    this.buttons = buttons;
    this.container.add([
      blocker,
      panel,
      title,
      ...buttons.flatMap((button) => [...button.visuals]),
    ]);

    router.on(TAP_EVENTS.PAUSE_RESUME, this.handleResumeTap);
    router.on(TAP_EVENTS.PAUSE_END_RUN, this.handleEndRunTap);
    router.on(TAP_EVENTS.PAUSE_TO_MENU, this.handleQuitTap);
  }

  get isOpen(): boolean {
    return this.opened;
  }

  open(): void {
    if (this.opened) {
      return;
    }
    this.opened = true;
    this.container.setVisible(true);
    for (const button of this.buttons) {
      this.router.registerZone({
        id: button.zoneId,
        bounds: button.bounds,
        priority: INPUT_PRIORITY.PAUSE_PANEL,
        event: button.event,
        layer: UI.PAUSE_LAYER_ID,
      });
    }
    this.router.setBlockingLayer(UI.PAUSE_LAYER_ID);
  }

  close(): void {
    if (!this.opened) {
      return;
    }
    this.opened = false;
    this.container.setVisible(false);
    for (const button of this.buttons) {
      this.router.unregisterZone(button.zoneId);
    }
    this.router.setBlockingLayer(null);
  }

  private readonly handleResumeTap = (): void => {
    playPressFeedback(this.scene, this.visualsFor(TAP_EVENTS.PAUSE_RESUME));
    this.close();
  };

  private readonly handleEndRunTap = (): void => {
    playPressFeedback(this.scene, this.visualsFor(TAP_EVENTS.PAUSE_END_RUN));
    this.callbacks.onEndRun();
  };

  private readonly handleQuitTap = (): void => {
    playPressFeedback(this.scene, this.visualsFor(TAP_EVENTS.PAUSE_TO_MENU));
    this.callbacks.onQuitToMenu();
  };

  private visualsFor(event: TapEventName): readonly Phaser.GameObjects.GameObject[] {
    return this.buttons.find((button) => button.event === event)?.visuals ?? [];
  }

  private createButton(
    centerX: number,
    centerY: number,
    zoneId: string,
    event: TapEventName,
    labelText: string,
  ): PanelButton {
    const button = createUiButton(
      this.scene,
      centerX,
      centerY,
      ASSET_KEYS.uiPlaceholder.pauseButton,
      labelText,
      this.buttonStyle(),
    );
    return {
      zoneId,
      event,
      bounds: {
        x: centerX - UI.PAUSE_BUTTON_WIDTH / 2,
        y: centerY - UI.PAUSE_BUTTON_HEIGHT / 2,
        width: UI.PAUSE_BUTTON_WIDTH,
        height: UI.PAUSE_BUTTON_HEIGHT,
      },
      visuals: button.visuals,
    };
  }

  private titleStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: UI.HUD_FONT_FAMILY,
      fontSize: UI.PAUSE_TITLE_FONT_SIZE,
      fontStyle: 'bold',
      color: UI.HUD_TEXT_COLOR,
      stroke: UI.HUD_STROKE_COLOR,
      strokeThickness: UI.HUD_STROKE_WIDTH,
    };
  }

  private buttonStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: UI.HUD_FONT_FAMILY,
      fontSize: UI.PAUSE_BUTTON_FONT_SIZE,
      fontStyle: 'bold',
      color: UI.HUD_TEXT_COLOR,
      stroke: UI.HUD_STROKE_COLOR,
      strokeThickness: UI.HUD_STROKE_WIDTH,
    };
  }
}
