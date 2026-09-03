import Phaser from 'phaser';
import { ASSET_KEYS, AUDIO_FORMATS } from '../config';

/**
 * BootScene — 资产加载与存档初始加载。
 * 职责仅限: 经 ASSET_KEYS 加载 assets/、读取 SaveData（经 persistence 层）、然后迁移到 TitleScene。
 * 音频实际解锁（AudioContext resume）在 TitleScene 首次输入时进行 — 规范 6（autoplay 应对）。
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // SFX-01～08（tech-stack.md 规范 5: 路径只经 ASSET_KEYS。各键给 OGG+M4A 双 URL、
    // Phaser AudioFile 按 canPlay 自动择一，无扩展名硬编码的格式分支）
    Object.values(ASSET_KEYS.audio).forEach((basePath) => {
      this.load.audio(basePath, AUDIO_FORMATS.map((ext) => `${basePath}.${ext}`));
    });
  }

  create(): void {
    this.scene.start('Title');
  }
}
