import Phaser from 'phaser';

/**
 * ResultScene — 结果画面（破产败局 / 终战胜负 / 3 种结局 + 总评分）。
 * 迁移: 重试当日（仅终战败）| 再来一周目 | 回到菜单。
 */
export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  create(): void {
    // TODO(S-08): 结果演出
  }
}
