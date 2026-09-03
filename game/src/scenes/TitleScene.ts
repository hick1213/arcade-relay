import Phaser from 'phaser';

/**
 * TitleScene — 标题画面。
 * 任意点击（首次输入时 resume AudioContext）迁移到 MenuScene。
 */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    this.input.once('pointerdown', () => {
      if (this.sound.locked) {
        this.sound.unlock();
      }
      this.scene.start('Menu');
    });
  }
}
