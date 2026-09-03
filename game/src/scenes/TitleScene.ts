/**
 * TitleScene — 标题画面（S-12）。
 *
 * 显示要素: emblem 占位（程序化纹理）、游戏标题文、「点击开始」提示（脉动闪烁）、
 * 存档损坏恢复会话中的 recovered 通知（1 次）。任意点击迁移到 MenuScene
 * （首次输入时 resume AudioContext — tech-stack 规范 6）。
 *
 * Scene 保持轻薄（tech-stack 规范 3）: 文案经 TextProvider（conventions 规则 4）、
 * 参数集中在 config.TITLE、存档读取经 persistence 层。
 */
import Phaser from 'phaser';
import { ASSET_KEYS, GAME_WIDTH, SPRITE_DISPLAY, TITLE, UI } from '../config';
import { loadSaveData } from '../persistence/SaveAdapter';
import { createFallbackTextProvider, TITLE_TEXT_KEYS } from '../ui/hudStrings';
import { ensureUiPlaceholderTextures } from '../ui/placeholderTextures';
import type { TextProvider } from '../types';

/** 脉动闪烁的相位换算（1 周期 = PROMPT_PULSE_MS 的余弦波） */
const PULSE_PHASE_CYCLE = Math.PI * 2;

export class TitleScene extends Phaser.Scene {
  private textProvider!: TextProvider;
  private promptText!: Phaser.GameObjects.Text;
  private elapsedMs = 0;

  constructor() {
    super('Title');
  }

  create(): void {
    this.textProvider = createFallbackTextProvider();
    ensureUiPlaceholderTextures(this);

    // 存档读取（经 persistence 层 — 损坏协议在 SaveAdapter。recovered 时显示 1 次通知）
    if (loadSaveData().recovered) {
      this.createRecoveredNotice();
    }

    this.createEmblem();
    this.createTitleText();
    this.promptText = this.createStartPrompt();

    this.input.once('pointerdown', () => {
      if (this.sound.locked) {
        this.sound.unlock();
      }
      this.scene.start('Menu');
    });
  }

  /** 「点击开始」提示的脉动（delta-time 驱动 — 帧率无关） */
  update(_time: number, delta: number): void {
    this.elapsedMs = (this.elapsedMs + delta) % TITLE.PROMPT_PULSE_MS;
    const phase = this.elapsedMs / TITLE.PROMPT_PULSE_MS;
    const alpha =
      TITLE.PROMPT_ALPHA_MIN +
      (1 - TITLE.PROMPT_ALPHA_MIN) * (0.5 - 0.5 * Math.cos(PULSE_PHASE_CYCLE * phase));
    this.promptText.setAlpha(alpha);
  }

  private createEmblem(): void {
    // S-33: 正式 emblem（IMG-29 — 無文字装飾。中央を空けた意匠にタイトル文を重ねる）。
    // プレースホルダ（uiPlaceholder.titleEmblem 160px 正方形）から assets.md 表示サイズへ。
    this.add
      .image(GAME_WIDTH / 2, TITLE.EMBLEM_Y, ASSET_KEYS.images.titleEmblem)
      .setDisplaySize(SPRITE_DISPLAY.TITLE_EMBLEM_WIDTH, SPRITE_DISPLAY.TITLE_EMBLEM_HEIGHT)
      .setDepth(UI.DEPTH_HUD);
  }

  private createTitleText(): void {
    this.add
      .text(GAME_WIDTH / 2, TITLE.TITLE_TEXT_Y, this.textProvider(TITLE_TEXT_KEYS.TITLE_GAME_TITLE), {
        fontFamily: UI.HUD_FONT_FAMILY,
        resolution: UI.TEXT_RESOLUTION,
        fontSize: TITLE.TITLE_FONT_SIZE,
        fontStyle: 'bold',
        color: UI.HUD_VALUE_COLOR,
        stroke: UI.HUD_STROKE_COLOR,
        strokeThickness: UI.HUD_STROKE_WIDTH,
      })
      .setOrigin(0.5)
      .setDepth(UI.DEPTH_HUD);
  }

  private createStartPrompt(): Phaser.GameObjects.Text {
    return this.add
      .text(GAME_WIDTH / 2, TITLE.PROMPT_Y, this.textProvider(TITLE_TEXT_KEYS.TITLE_START_PROMPT), {
        fontFamily: UI.HUD_FONT_FAMILY,
        resolution: UI.TEXT_RESOLUTION,
        fontSize: TITLE.PROMPT_FONT_SIZE,
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
        TITLE.RECOVERED_NOTICE_Y,
        this.textProvider(TITLE_TEXT_KEYS.TITLE_RECOVERED_NOTICE),
        {
          fontFamily: UI.HUD_FONT_FAMILY,
          resolution: UI.TEXT_RESOLUTION,
          fontSize: TITLE.RECOVERED_NOTICE_FONT_SIZE,
          color: UI.HUD_FLASH_UP_COLOR,
          stroke: UI.HUD_STROKE_COLOR,
          strokeThickness: UI.HUD_STROKE_WIDTH,
        },
      )
      .setOrigin(0.5)
      .setDepth(UI.DEPTH_HUD);
  }
}
