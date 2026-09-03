/**
 * UI 按钮的共通生成与按压反馈（S-10）。
 * 判定区本身不注册 Phaser interactive — 点击统一经 systems/input/InputRouter 仲裁
 * （conventions 规则 7），本模块只负责绘制与按下动画。
 */
import Phaser from 'phaser';
import { UI } from '../config';

export interface UiButton {
  readonly visuals: Phaser.GameObjects.GameObject[];
}

export const createUiButton = (
  scene: Phaser.Scene,
  centerX: number,
  centerY: number,
  textureKey: string,
  labelText: string,
  textStyle: Phaser.Types.GameObjects.Text.TextStyle,
): UiButton => {
  const background = scene.add.image(centerX, centerY, textureKey).setOrigin(0.5);
  // S-32: 按钮标签一律以 TEXT_RESOLUTION 光栅化（调用方 style 未指定时也保证不模糊）
  const label = scene.add
    .text(centerX, centerY, labelText, { ...textStyle, resolution: UI.TEXT_RESOLUTION })
    .setOrigin(0.5);
  return { visuals: [background, label] };
};

/** 按压反馈: 短促缩小→回弹（单次点击即触发） */
export const playPressFeedback = (
  scene: Phaser.Scene,
  visuals: readonly Phaser.GameObjects.GameObject[],
): void => {
  scene.tweens.add({
    targets: [...visuals],
    scale: UI.BUTTON_PRESS_SCALE,
    duration: UI.BUTTON_PRESS_MS / 2,
    yoyo: true,
    ease: 'Quad.easeOut',
  });
};
