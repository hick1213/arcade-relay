/**
 * VolumeSlider — 音量滑块显示组件（S-13 设置面板）。
 *
 * - P-04 纯点击: 点击轨道任意位置即把音量设定为该位置的值（无拖拽依赖）。
 *   判定区经 InputRouter 注册（仅面板开启期间），命中事件带 TapHit.x —
 *   由接线层经 volumeFromPointerX 换算为 0–1 的音量值。
 * - UI 只做显示与判定区提供，不持有音量状态（真值 = SaveData.settings，
 *   经 render() 反映 — ui-code 规范: 禁止双重管理）。
 */
import Phaser from 'phaser';
import { MENU, UI } from '../config';
import { formatVolumePercent } from './hudStrings';

export interface VolumeSliderOptions {
  /** 滑块行中心 Y（画面坐标） */
  readonly centerY: number;
  readonly labelText: string;
}

export class VolumeSlider {
  readonly visuals: readonly Phaser.GameObjects.GameObject[];
  /** 轨道判定区（画面坐标。InputRouter 侧经 clampTapBounds 保证 ≥ BUTTON_MIN_SIZE_PX） */
  readonly zoneBounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  /** 轨道左端 X（TapHit.x → 音量值换算用） */
  readonly trackLeft: number;

  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly handle: Phaser.GameObjects.Rectangle;
  private readonly valueText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, centerX: number, options: VolumeSliderOptions) {
    const trackCenterX = centerX + MENU.SLIDER_TRACK_X_OFFSET;
    this.trackLeft = trackCenterX - MENU.SLIDER_TRACK_WIDTH / 2;

    const label = scene.add
      .text(centerX + MENU.SLIDER_LABEL_X_OFFSET, options.centerY, options.labelText, {
        fontFamily: UI.HUD_FONT_FAMILY,
        fontSize: MENU.SLIDER_FONT_SIZE,
        fontStyle: 'bold',
        color: UI.HUD_TEXT_COLOR,
        stroke: UI.HUD_STROKE_COLOR,
        strokeThickness: UI.HUD_STROKE_WIDTH,
      })
      .setOrigin(0.5);

    const track = scene.add
      .rectangle(
        trackCenterX,
        options.centerY,
        MENU.SLIDER_TRACK_WIDTH,
        MENU.SLIDER_TRACK_HEIGHT,
        UI.PANEL_STROKE,
      )
      .setOrigin(0.5);

    this.fill = scene.add
      .rectangle(this.trackLeft, options.centerY, 0, MENU.SLIDER_TRACK_HEIGHT, UI.PANEL_ACCENT)
      .setOrigin(0, 0.5);

    this.handle = scene.add
      .rectangle(
        trackCenterX,
        options.centerY,
        MENU.SLIDER_HANDLE_WIDTH,
        MENU.SLIDER_HANDLE_HEIGHT,
        UI.PANEL_BRIGHT_ACCENT,
      )
      .setOrigin(0.5)
      .setStrokeStyle(UI.PANEL_ACCENT_WIDTH, UI.PANEL_STROKE);

    this.valueText = scene.add
      .text(centerX + MENU.SLIDER_VALUE_X_OFFSET, options.centerY, '', {
        fontFamily: UI.HUD_FONT_FAMILY,
        fontSize: MENU.SLIDER_FONT_SIZE,
        color: UI.HUD_TEXT_COLOR,
        stroke: UI.HUD_STROKE_COLOR,
        strokeThickness: UI.HUD_STROKE_WIDTH,
      })
      .setOrigin(0.5);

    this.visuals = [label, track, this.fill, this.handle, this.valueText];
    this.zoneBounds = {
      x: this.trackLeft,
      y: options.centerY - MENU.SLIDER_TRACK_HEIGHT / 2,
      width: MENU.SLIDER_TRACK_WIDTH,
      height: MENU.SLIDER_TRACK_HEIGHT,
    };
  }

  /** 真值（SaveData.settings 的音量）を反映。百分比显示は格式化関数経由 */
  render(value: number): void {
    this.fill.width = value * MENU.SLIDER_TRACK_WIDTH;
    this.handle.x = this.trackLeft + value * MENU.SLIDER_TRACK_WIDTH;
    this.valueText.setText(formatVolumePercent(value));
  }
}

/** TapHit.x → 0–1 音量值（点击点在轨道左端=0、右端=1、轨道外 clamp — P-04 单击设定） */
export const volumeFromPointerX = (pointerX: number, slider: VolumeSlider): number => {
  const raw = (pointerX - slider.trackLeft) / MENU.SLIDER_TRACK_WIDTH;
  return Math.min(1, Math.max(0, raw));
};
