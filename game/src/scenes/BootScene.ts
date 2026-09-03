import Phaser from 'phaser';
import { ASSET_KEYS } from '../config';

/**
 * BootScene — 资产加载与存档初始加载。
 * 职责仅限: 加载 assets/、读取 SaveData（经 persistence 层）、然后迁移到 TitleScene。
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // 资产加载在实现各系统的 story 中经 ASSET_KEYS 登记（tech-stack.md 规范 5）
    void ASSET_KEYS;
  }

  create(): void {
    this.scene.start('Title');
  }
}
