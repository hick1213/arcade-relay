/**
 * Hud — 画面常驻 HUD（S-10）: 银子 / 声望 / 日数 3 枚 chip ＋右上「帐本」按钮。
 *
 * - 显示值每次从 game state（Systems 层真值）推导（ui-code 规范）— 本组件只缓存
 *   「前回表示値」用于变化检测，不持有独立计数器。
 * - 数值变化有即时反馈: 文字变色（增=金 / 减=朱）＋缩放脉冲＋Δ 数字弹出。
 * - 点击判定经 InputRouter 注册（优先级 = PAUSE_PANEL 档 — 暂停系入口最高优先）。
 */
import Phaser from 'phaser';
import { ASSET_KEYS, GAME_WIDTH, INPUT_PRIORITY, UI } from '../config';
import type { InputRouter } from '../systems/input/InputRouter';
import { TAP_EVENTS, type HudState, type TextProvider } from '../types';
import { HUD_TEXT_KEYS } from './hudStrings';
import { ensureUiPlaceholderTextures } from './placeholderTextures';
import { createUiButton, playPressFeedback } from './UiButton';

type HudChipKey = 'silver' | 'reputation' | 'day';

interface HudChip {
  readonly valueText: Phaser.GameObjects.Text;
  readonly baseColor: string;
  /** Δ 弹出数字の再利用インスタンス（CR-CODE fix: 每回 Text 新規生成は resolution 2 光栅化的 GC 圧力源） */
  readonly popup: Phaser.GameObjects.Text;
  /** popup を動かす tween のハンドル（表示キャッシュ。連続 flash 時は差し替え） */
  popupTween: Phaser.Tweens.Tween | null;
}

export class Hud {
  readonly container: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private readonly textProvider: TextProvider;
  private readonly onLedgerTapped: () => void;
  private readonly chips: Readonly<Record<HudChipKey, HudChip>>;
  /** 前回表示値のキャッシュのみ（真值は Systems 层 — 禁止双重管理） */
  private previous: HudState | null = null;

  constructor(
    scene: Phaser.Scene,
    textProvider: TextProvider,
    router: InputRouter,
    onLedgerTapped: () => void,
  ) {
    this.scene = scene;
    this.textProvider = textProvider;
    this.onLedgerTapped = onLedgerTapped;
    ensureUiPlaceholderTextures(scene);
    this.container = scene.add.container(0, 0).setDepth(UI.DEPTH_HUD);
    this.chips = {
      silver: this.createChip(0, HUD_TEXT_KEYS.HUD_SILVER),
      reputation: this.createChip(1, HUD_TEXT_KEYS.HUD_REPUTATION),
      day: this.createChip(2, HUD_TEXT_KEYS.HUD_DAY),
    };
    this.createLedgerButton(router);
  }

  /** game state（Systems 层の真値）を反映。变化分に即时反馈を付与 */
  update(state: HudState): void {
    this.applyChip('silver', state.silver);
    this.applyChip('reputation', state.reputation);
    this.applyChip('day', state.day);
    this.previous = { ...state };
  }

  private applyChip(key: HudChipKey, value: number): void {
    const chip = this.chips[key];
    const display = Math.round(value);
    chip.valueText.setText(String(display));
    const prev = this.previous === null ? null : Math.round(this.previous[key]);
    if (prev !== null && prev !== display) {
      this.flash(chip, display - prev);
    }
  }

  /** 即时反馈: 值文字变色＋缩放脉冲＋Δ 数字向上弹出消散 */
  private flash(chip: HudChip, delta: number): void {
    chip.valueText.setColor(delta > 0 ? UI.HUD_FLASH_UP_COLOR : UI.HUD_FLASH_DOWN_COLOR);
    this.scene.time.delayedCall(UI.HUD_FLASH_MS, () => chip.valueText.setColor(chip.baseColor));
    this.scene.tweens.add({
      targets: chip.valueText,
      scale: UI.HUD_FLASH_SCALE,
      duration: UI.HUD_FLASH_MS / 2,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
    this.runPopup(chip, delta);
  }

  /**
   * Δ 数字弹出 — chip 毎に 1 個の Text を再利用（CR-CODE it.1 fix）。
   * 每回の新規生成＋destroy は resolution 2 光栅化の反复割付で GC 圧力になるため廃止。
   * 連続 flash 時は進行中 tween を差し替えて最初から再生する。
   */
  private runPopup(chip: HudChip, delta: number): void {
    const popup = chip.popup;
    popup.setText(`${delta > 0 ? '+' : ''}${delta}`);
    popup.setPosition(
      chip.valueText.x - chip.valueText.displayWidth / 2,
      chip.valueText.y - UI.HUD_CHIP_HEIGHT / 2 - UI.HUD_POPUP_OFFSET_Y,
    );
    popup.setAlpha(1).setVisible(true);
    chip.popupTween?.remove();
    chip.popupTween = this.scene.tweens.add({
      targets: popup,
      y: popup.y - UI.HUD_POPUP_RISE_PX,
      alpha: 0,
      duration: UI.HUD_POPUP_MS,
      ease: 'Quad.easeOut',
      onComplete: () => popup.setVisible(false),
    });
  }

  private createChip(index: number, labelKey: string): HudChip {
    const x = UI.HUD_MARGIN + index * (UI.HUD_CHIP_WIDTH + UI.HUD_CHIP_GAP);
    const y = UI.HUD_MARGIN;
    const panel = this.scene.add
      .image(x, y, ASSET_KEYS.uiPlaceholder.hudChip)
      .setOrigin(0, 0);
    const label = this.scene.add
      .text(
        x + UI.HUD_CHIP_PADDING,
        y + UI.HUD_CHIP_HEIGHT / 2,
        this.textProvider(labelKey),
        this.labelStyle(),
      )
      .setOrigin(0, 0.5);
    const valueText = this.scene.add
      .text(x + UI.HUD_CHIP_WIDTH - UI.HUD_CHIP_PADDING, y + UI.HUD_CHIP_HEIGHT / 2, '', this.valueStyle())
      .setOrigin(1, 0.5);
    // Δ 弹出数字は chip 毎に 1 個を事前生成し flash 時に再利用（GC 圧力対策 — runPopup 参照）
    const popup = this.scene.add
      .text(x + UI.HUD_CHIP_WIDTH / 2, y + UI.HUD_CHIP_HEIGHT / 2, '', this.popupStyle())
      .setOrigin(0.5)
      .setVisible(false);
    this.container.add([panel, label, valueText, popup]);
    return { valueText, baseColor: UI.HUD_VALUE_COLOR, popup, popupTween: null };
  }

  /** 右上「帐本」按钮（≥ BUTTON_MIN_SIZE_PX）。判定区经 InputRouter、最高优先档 */
  private createLedgerButton(router: InputRouter): readonly Phaser.GameObjects.GameObject[] {
    const centerX = GAME_WIDTH - UI.HUD_MARGIN - UI.HUD_LEDGER_WIDTH / 2;
    const centerY = UI.HUD_MARGIN + UI.HUD_BAR_HEIGHT / 2;
    const button = createUiButton(
      this.scene,
      centerX,
      centerY,
      ASSET_KEYS.uiPlaceholder.ledgerButton,
      this.textProvider(HUD_TEXT_KEYS.HUD_LEDGER),
      this.ledgerStyle(),
    );
    this.container.add(button.visuals);
    router.registerZone({
      id: UI.ZONE_LEDGER,
      bounds: {
        x: centerX - UI.HUD_LEDGER_WIDTH / 2,
        y: centerY - UI.HUD_LEDGER_HEIGHT / 2,
        width: UI.HUD_LEDGER_WIDTH,
        height: UI.HUD_LEDGER_HEIGHT,
      },
      priority: INPUT_PRIORITY.PAUSE_PANEL,
      event: TAP_EVENTS.LEDGER_BUTTON,
    });
    router.on(TAP_EVENTS.LEDGER_BUTTON, () => {
      playPressFeedback(this.scene, button.visuals);
      this.onLedgerTapped();
    });
    return button.visuals;
  }

  private labelStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: UI.HUD_FONT_FAMILY,
      resolution: UI.TEXT_RESOLUTION,
      fontSize: UI.HUD_LABEL_FONT_SIZE,
      color: UI.HUD_TEXT_COLOR,
      stroke: UI.HUD_STROKE_COLOR,
      strokeThickness: UI.HUD_STROKE_WIDTH,
    };
  }

  private valueStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: UI.HUD_FONT_FAMILY,
      resolution: UI.TEXT_RESOLUTION,
      fontSize: UI.HUD_VALUE_FONT_SIZE,
      fontStyle: 'bold',
      color: UI.HUD_VALUE_COLOR,
      stroke: UI.HUD_STROKE_COLOR,
      strokeThickness: UI.HUD_STROKE_WIDTH,
    };
  }

  private ledgerStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: UI.HUD_FONT_FAMILY,
      resolution: UI.TEXT_RESOLUTION,
      fontSize: UI.HUD_LEDGER_FONT_SIZE,
      fontStyle: 'bold',
      color: UI.HUD_TEXT_COLOR,
      stroke: UI.HUD_STROKE_COLOR,
      strokeThickness: UI.HUD_STROKE_WIDTH,
    };
  }

  private popupStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: UI.HUD_FONT_FAMILY,
      resolution: UI.TEXT_RESOLUTION,
      fontSize: UI.HUD_POPUP_FONT_SIZE,
      fontStyle: 'bold',
      color: UI.HUD_FLASH_UP_COLOR,
      stroke: UI.HUD_STROKE_COLOR,
      strokeThickness: UI.HUD_STROKE_WIDTH,
    };
  }
}
