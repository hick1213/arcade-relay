/**
 * MenuSettingsPanel — 「设置」模态面板（S-13 设置 = Menu 必需要素 3）。
 *
 * - BGM/SFX 音量滑块（0–1）。点击轨道即设定（P-04 单击）。真值 = SaveData.settings —
 *   变更经 callbacks.onVolumeChange 通知接线层（持久化 + 实时作用于 sound.volume），
 *   本组件不持有音量状态、仅经 render() 反映接线层传回的真值。
 * - 操作说明面板（面板内提示块 — 游玩前的操作引导）。
 * - 开启中经 InputRouter.setBlockingLayer 屏蔽基础按钮（conventions 规则 7）。
 */
import Phaser from 'phaser';
import { ASSET_KEYS, GAME_HEIGHT, GAME_WIDTH, MENU, UI } from '../config';
import type { InputRouter } from '../systems/input/InputRouter';
import type { TapEventName, TapHit, TextProvider } from '../types';
import { TAP_EVENTS } from '../types';
import { MENU_TEXT_KEYS } from './hudStrings';
import { ensureUiPlaceholderTextures } from './placeholderTextures';
import { createUiButton, playPressFeedback } from './UiButton';
import { VolumeSlider, volumeFromPointerX } from './VolumeSlider';

export type VolumeChannel = 'bgm' | 'sfx';

export interface MenuSettingsPanelCallbacks {
  /** 滑块变更（0–1）。接线层负责: SaveData.settings 更新 + persist + 实时音频反映 */
  readonly onVolumeChange: (channel: VolumeChannel, value: number) => void;
  /** 语言切换（S-11）。接线层负责: i18n.setLanguage + settings.lang 持久化 + 再描画 */
  readonly onLanguageToggle: () => void;
}

interface SliderEntry {
  readonly slider: VolumeSlider;
  readonly zoneId: string;
  readonly event: TapEventName;
  readonly channel: VolumeChannel;
}

export class MenuSettingsPanel {
  readonly container: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private readonly router: InputRouter;
  private readonly callbacks: MenuSettingsPanelCallbacks;
  private readonly sliders: readonly SliderEntry[];
  private readonly closeVisuals: readonly Phaser.GameObjects.GameObject[];
  private readonly closeBounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  private readonly languageVisuals: readonly Phaser.GameObjects.GameObject[];
  private readonly languageBounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  private opened = false;

  constructor(
    scene: Phaser.Scene,
    textProvider: TextProvider,
    router: InputRouter,
    callbacks: MenuSettingsPanelCallbacks,
  ) {
    this.scene = scene;
    this.router = router;
    this.callbacks = callbacks;
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
        textProvider(MENU_TEXT_KEYS.MENU_SETTINGS_TITLE),
        this.titleStyle(),
      )
      .setOrigin(0.5);

    // 音量滑块（初始值由接线层在创建后立即 render — 真值 = SaveData.settings）
    const bgmSlider = new VolumeSlider(scene, centerX, {
      centerY: MENU.SETTINGS_BGM_Y,
      labelText: textProvider(MENU_TEXT_KEYS.MENU_BGM_LABEL),
    });
    const sfxSlider = new VolumeSlider(scene, centerX, {
      centerY: MENU.SETTINGS_SFX_Y,
      labelText: textProvider(MENU_TEXT_KEYS.MENU_SFX_LABEL),
    });
    this.sliders = [
      { slider: bgmSlider, zoneId: MENU.ZONE_BGM_SLIDER, event: TAP_EVENTS.MENU_BGM_VOLUME, channel: 'bgm' },
      { slider: sfxSlider, zoneId: MENU.ZONE_SFX_SLIDER, event: TAP_EVENTS.MENU_SFX_VOLUME, channel: 'sfx' },
    ];

    const hintTitle = scene.add
      .text(centerX, MENU.PANEL_HINT_TITLE_Y, textProvider(MENU_TEXT_KEYS.MENU_HINT_TITLE), this.hintTitleStyle())
      .setOrigin(0.5);
    const hintBody = scene.add
      .text(centerX, MENU.PANEL_HINT_BODY_Y, textProvider(MENU_TEXT_KEYS.MENU_HINT_BODY), this.hintBodyStyle())
      .setOrigin(0.5, 0);
    hintBody.setWordWrapWidth(MENU.PANEL_HINT_WRAP_WIDTH);

    // 语言切换按钮（S-11: zh/en 即时切换。ラベルは現行言語を表示 — クリックで切替）
    const languageButton = createUiButton(
      scene,
      centerX,
      MENU.LANGUAGE_BUTTON_Y,
      ASSET_KEYS.uiPlaceholder.menuButton,
      textProvider(MENU_TEXT_KEYS.MENU_LANGUAGE_LABEL),
      this.languageButtonStyle(),
    );
    this.languageVisuals = languageButton.visuals;
    this.languageBounds = {
      x: centerX - MENU.LANGUAGE_BUTTON_WIDTH / 2,
      y: MENU.LANGUAGE_BUTTON_Y - MENU.LANGUAGE_BUTTON_HEIGHT / 2,
      width: MENU.LANGUAGE_BUTTON_WIDTH,
      height: MENU.LANGUAGE_BUTTON_HEIGHT,
    };

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
      ...bgmSlider.visuals,
      ...sfxSlider.visuals,
      hintTitle,
      hintBody,
      ...languageButton.visuals,
      ...closeButton.visuals,
    ]);

    router.on(TAP_EVENTS.MENU_BGM_VOLUME, this.handleVolumeTap);
    router.on(TAP_EVENTS.MENU_SFX_VOLUME, this.handleVolumeTap);
    router.on(TAP_EVENTS.MENU_LANGUAGE_TOGGLE, this.handleLanguageTap);
    router.on(TAP_EVENTS.MENU_CLOSE_PANEL, this.handleCloseTap);
  }

  /** 创建时以 SaveData.settings 的真值描画初始状态 */
  renderVolumes(bgmVolume: number, sfxVolume: number): void {
    for (const entry of this.sliders) {
      entry.slider.render(entry.channel === 'bgm' ? bgmVolume : sfxVolume);
    }
  }

  open(): void {
    if (this.opened) {
      return;
    }
    this.opened = true;
    this.container.setVisible(true);
    for (const entry of this.sliders) {
      this.router.registerZone({
        id: entry.zoneId,
        bounds: entry.slider.zoneBounds,
        priority: MENU.PRIORITY_MODAL,
        event: entry.event,
        layer: MENU.LAYER_ID,
      });
    }
    this.router.registerZone({
      id: MENU.ZONE_SETTINGS_CLOSE,
      bounds: this.closeBounds,
      priority: MENU.PRIORITY_MODAL,
      event: TAP_EVENTS.MENU_CLOSE_PANEL,
      layer: MENU.LAYER_ID,
    });
    this.router.registerZone({
      id: MENU.ZONE_LANGUAGE_TOGGLE,
      bounds: this.languageBounds,
      priority: MENU.PRIORITY_MODAL,
      event: TAP_EVENTS.MENU_LANGUAGE_TOGGLE,
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
    for (const entry of this.sliders) {
      this.router.unregisterZone(entry.zoneId);
    }
    this.router.unregisterZone(MENU.ZONE_SETTINGS_CLOSE);
    this.router.unregisterZone(MENU.ZONE_LANGUAGE_TOGGLE);
    this.router.setBlockingLayer(null);
  }

  private readonly handleVolumeTap = (hit: TapHit): void => {
    const entry = this.sliders.find((candidate) => candidate.event === hit.event);
    if (entry === undefined) {
      return;
    }
    const value = volumeFromPointerX(hit.x, entry.slider);
    this.callbacks.onVolumeChange(entry.channel, value);
  };

  private readonly handleCloseTap = (): void => {
    playPressFeedback(this.scene, this.closeVisuals);
    this.close();
  };

  private readonly handleLanguageTap = (): void => {
    playPressFeedback(this.scene, this.languageVisuals);
    this.callbacks.onLanguageToggle();
  };

  private languageButtonStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: UI.HUD_FONT_FAMILY,
      resolution: UI.TEXT_RESOLUTION,
      fontSize: MENU.LANGUAGE_BUTTON_FONT_SIZE,
      color: UI.HUD_TEXT_COLOR,
      stroke: UI.HUD_STROKE_COLOR,
      strokeThickness: UI.HUD_STROKE_WIDTH,
    };
  }

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

  private hintTitleStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: UI.HUD_FONT_FAMILY,
      resolution: UI.TEXT_RESOLUTION,
      fontSize: MENU.PANEL_HINT_TITLE_FONT_SIZE,
      fontStyle: 'bold',
      color: UI.HUD_TEXT_COLOR,
      stroke: UI.HUD_STROKE_COLOR,
      strokeThickness: UI.HUD_STROKE_WIDTH,
    };
  }

  private hintBodyStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: UI.HUD_FONT_FAMILY,
      resolution: UI.TEXT_RESOLUTION,
      fontSize: MENU.PANEL_HINT_BODY_FONT_SIZE,
      color: UI.HUD_TEXT_COLOR,
      stroke: UI.HUD_STROKE_COLOR,
      strokeThickness: UI.HUD_STROKE_WIDTH,
      wordWrap: { width: MENU.PANEL_HINT_WRAP_WIDTH },
      align: 'center',
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
