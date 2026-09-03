/**
 * MenuScene — 主菜单（S-13: Menu 必需要素 4 项齐全 — contract §11）。
 *
 * - 开始游戏: 「新周目」→ GameScene（志向选择）; run 快照存在时另显示「继续周目」。
 * - 游戏外显示: 「图鉴・统计」面板（最高分/统计/结局图鉴 — 元进度自 SaveData 推导）。
 * - 设置: BGM/SFX 音量滑块（0–1、实时作用于音频输出）＋操作说明; 变更即持久化
 *   （conventions 规则 8: 音量只经 SaveData.settings 控制 — 仅显示的设置不合格）。
 * - 退出入口: 「返回标题」→ TitleScene。
 *
 * Scene 保持轻薄（tech-stack 规范 3）: 显示组件在 ui/、点击仲裁在 systems/input、
 * 存档 I/O 在 persistence/。本场景只做生命周期与接线。
 */
import Phaser from 'phaser';
import {
  ASSET_KEYS,
  GAME_WIDTH,
  MENU,
  UI,
} from '../config';
import { loadSaveData, saveSaveData } from '../persistence/SaveAdapter';
import { setLanguage } from '../systems/i18n';
import { InputRouter } from '../systems/input/InputRouter';
import type { SaveData, TapEventName, TextProvider } from '../types';
import { TAP_EVENTS } from '../types';
import { MenuSettingsPanel, type VolumeChannel } from '../ui/MenuSettingsPanel';
import { MenuStatsPanel } from '../ui/MenuStatsPanel';
import { MENU_TEXT_KEYS } from '../ui/hudStrings';
import { createFallbackTextProvider } from '../ui/hudStrings';
import { ensureUiPlaceholderTextures } from '../ui/placeholderTextures';
import { createUiButton, playPressFeedback } from '../ui/UiButton';

interface MenuButtonEntry {
  readonly zoneId: string;
  readonly event: TapEventName;
  readonly visuals: readonly Phaser.GameObjects.GameObject[];
}

export class MenuScene extends Phaser.Scene {
  private router!: InputRouter;
  private textProvider!: TextProvider;
  private save!: SaveData;
  private statsPanel!: MenuStatsPanel;
  private settingsPanel!: MenuSettingsPanel;
  private readonly buttons: MenuButtonEntry[] = [];

  constructor() {
    super('Menu');
  }

  create(): void {
    this.router = new InputRouter();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.router.handlePointerDown(pointer.x, pointer.y);
    });
    this.textProvider = createFallbackTextProvider();
    ensureUiPlaceholderTextures(this);
    this.buttons.length = 0;

    // 存档读取（经 persistence 层 — 损坏协议在 SaveAdapter。recovered 时显示 1 次通知）
    const loaded = loadSaveData();
    this.save = loaded.data;
    // 言語真値の反映（S-11 — scene.restart 後の再描画でも保存言語が保持される）
    setLanguage(this.save.settings.lang);

    this.createTitle();
    if (loaded.recovered) {
      this.createRecoveredNotice();
    }
    this.createButtons();

    this.statsPanel = new MenuStatsPanel(this, this.textProvider, this.router, this.save);
    this.settingsPanel = new MenuSettingsPanel(this, this.textProvider, this.router, {
      onVolumeChange: (channel, value) => this.handleVolumeChange(channel, value),
      onLanguageToggle: () => this.handleLanguageToggle(),
    });
    // 滑块初始值 = SaveData.settings 真值（UI 不持有状态）
    this.settingsPanel.renderVolumes(
      this.save.settings.bgm_volume,
      this.save.settings.sfx_volume,
    );

    // 音量接线到实际音频输出（conventions 规则 8。BGM 走主音量 — QA 验证项）
    this.applyMasterVolume(this.save.settings.bgm_volume);
  }

  private createTitle(): void {
    this.add
      .text(GAME_WIDTH / 2, MENU.TITLE_Y, this.textProvider(MENU_TEXT_KEYS.MENU_TITLE), {
        fontFamily: UI.HUD_FONT_FAMILY,
        fontSize: MENU.TITLE_FONT_SIZE,
        fontStyle: 'bold',
        color: UI.HUD_TEXT_COLOR,
        stroke: UI.HUD_STROKE_COLOR,
        strokeThickness: UI.HUD_STROKE_WIDTH,
      })
      .setOrigin(0.5)
      .setDepth(UI.DEPTH_HUD);
  }

  private createRecoveredNotice(): void {
    this.add
      .text(
        GAME_WIDTH / 2,
        MENU.RECOVERED_NOTICE_Y,
        this.textProvider(MENU_TEXT_KEYS.MENU_RECOVERED_NOTICE),
        {
          fontFamily: UI.HUD_FONT_FAMILY,
          fontSize: MENU.RECOVERED_NOTICE_FONT_SIZE,
          color: UI.HUD_FLASH_UP_COLOR,
          stroke: UI.HUD_STROKE_COLOR,
          strokeThickness: UI.HUD_STROKE_WIDTH,
        },
      )
      .setOrigin(0.5)
      .setDepth(UI.DEPTH_HUD);
  }

  private createButtons(): void {
    // 「继续周目」仅 run 快照存在时显示（architecture §1 — 防恢复死周目）
    if (this.save.run !== null) {
      this.addButton(MENU.ZONE_CONTINUE, TAP_EVENTS.MENU_CONTINUE, MENU_TEXT_KEYS.MENU_CONTINUE);
    }
    this.addButton(MENU.ZONE_NEW_RUN, TAP_EVENTS.MENU_NEW_RUN, MENU_TEXT_KEYS.MENU_NEW_RUN);
    this.addButton(MENU.ZONE_OPEN_STATS, TAP_EVENTS.MENU_OPEN_STATS, MENU_TEXT_KEYS.MENU_OPEN_STATS);
    this.addButton(
      MENU.ZONE_OPEN_SETTINGS,
      TAP_EVENTS.MENU_OPEN_SETTINGS,
      MENU_TEXT_KEYS.MENU_OPEN_SETTINGS,
    );
    this.addButton(MENU.ZONE_BACK_TITLE, TAP_EVENTS.MENU_BACK_TITLE, MENU_TEXT_KEYS.MENU_BACK_TITLE);

    this.router.on(TAP_EVENTS.MENU_CONTINUE, () =>
      this.activateButton(TAP_EVENTS.MENU_CONTINUE, () => this.scene.start('Game', { resume: true })),
    );
    this.router.on(TAP_EVENTS.MENU_NEW_RUN, () => this.activateButton(TAP_EVENTS.MENU_NEW_RUN, () => this.scene.start('Game')));
    this.router.on(TAP_EVENTS.MENU_OPEN_STATS, () => this.activateButton(TAP_EVENTS.MENU_OPEN_STATS, () => this.statsPanel.open()));
    this.router.on(TAP_EVENTS.MENU_OPEN_SETTINGS, () =>
      this.activateButton(TAP_EVENTS.MENU_OPEN_SETTINGS, () => this.settingsPanel.open()),
    );
    this.router.on(TAP_EVENTS.MENU_BACK_TITLE, () => this.activateButton(TAP_EVENTS.MENU_BACK_TITLE, () => this.scene.start('Title')));
  }

  private addButton(zoneId: string, event: TapEventName, labelKey: string): void {
    const index = this.buttons.length;
    const centerY = MENU.BUTTON_START_Y + index * MENU.BUTTON_GAP;
    const button = createUiButton(
      this,
      GAME_WIDTH / 2,
      centerY,
      ASSET_KEYS.uiPlaceholder.menuButton,
      this.textProvider(labelKey),
      this.buttonStyle(),
    );
    this.router.registerZone({
      id: zoneId,
      bounds: {
        x: GAME_WIDTH / 2 - MENU.BUTTON_WIDTH / 2,
        y: centerY - MENU.BUTTON_HEIGHT / 2,
        width: MENU.BUTTON_WIDTH,
        height: MENU.BUTTON_HEIGHT,
      },
      priority: MENU.PRIORITY_BUTTON,
      event,
    });
    this.buttons.push({ zoneId, event, visuals: button.visuals });
  }

  /** 按压反馈 + UI tap 音效（首次用户操作后才会发声 — tech-stack 规范 6）后执行动作 */
  private activateButton(event: TapEventName, action: () => void): void {
    const entry = this.buttons.find((candidate) => candidate.event === event);
    if (entry !== undefined) {
      playPressFeedback(this, entry.visuals);
    }
    this.playUiTap();
    action();
  }

  private playUiTap(): void {
    if (this.sound.locked) {
      return;
    }
    this.sound.play(ASSET_KEYS.audio.sfxUiTap, { volume: this.save.settings.sfx_volume });
  }

  /**
   * 语言切换（S-11: 即时生效 — 无需刷新）。
   * i18n モジュールの現行言語を切替 → SaveData.settings.lang へ真値反映＋持久化 →
   * 本场景再構築（create から言語表の新文案で再描画 — ページリロード不要）。
   */
  private handleLanguageToggle(): void {
    const next = this.save.settings.lang === 'zh' ? 'en' : 'zh';
    setLanguage(next);
    this.save = { ...this.save, settings: { ...this.save.settings, lang: next } };
    saveSaveData(this.save);
    this.scene.restart();
  }

  /** 滑块变更: 真值更新（SaveData.settings）→ 立即持久化 → 实时反映到音频输出 */
  private handleVolumeChange(channel: VolumeChannel, value: number): void {
    const bgmVolume = channel === 'bgm' ? value : this.save.settings.bgm_volume;
    const sfxVolume = channel === 'sfx' ? value : this.save.settings.sfx_volume;
    this.save = {
      ...this.save,
      settings: { ...this.save.settings, bgm_volume: bgmVolume, sfx_volume: sfxVolume },
    };
    saveSaveData(this.save);
    this.settingsPanel.renderVolumes(bgmVolume, sfxVolume);
    if (channel === 'bgm') {
      this.applyMasterVolume(bgmVolume);
    }
  }

  /**
   * BGM 主音量を实际音频输出（主增益节点）へ反映。
   * Phaser 3.90 的 WebAudioSoundManager#volume setter 每次都调度 `setValueAtTime(value, 0)`，
   * 与 timeline 上已有的事件同时刻（或更早）重复调度时 Chromium 会静默忽略 — 表现为
   * 「第二次之后的音量变更不生效」。因此先 cancel 再以当前 AudioContext 时刻重新调度。
   * WebAudio 以外的 SoundManager（HTML5/NoAudio）没有该节点，走普通 setter（可靠）。
   */
  private applyMasterVolume(value: number): void {
    const manager = this.sound as Phaser.Sound.WebAudioSoundManager;
    if (manager.masterVolumeNode !== undefined && manager.context !== undefined) {
      const gain = manager.masterVolumeNode.gain;
      gain.cancelScheduledValues(manager.context.currentTime);
      gain.setValueAtTime(value, manager.context.currentTime);
    } else {
      manager.volume = value;
    }
  }

  private buttonStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: UI.HUD_FONT_FAMILY,
      fontSize: MENU.BUTTON_FONT_SIZE,
      fontStyle: 'bold',
      color: UI.HUD_TEXT_COLOR,
      stroke: UI.HUD_STROKE_COLOR,
      strokeThickness: UI.HUD_STROKE_WIDTH,
    };
  }
}
