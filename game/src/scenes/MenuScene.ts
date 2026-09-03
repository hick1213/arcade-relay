import Phaser from 'phaser';

/**
 * MenuScene — 主菜单。
 * 必需要素（contract §11）: 开始游戏（继续周目/新周目）、游戏外显示（结局图鉴/成就/统计）、
 * 设置（音量/语言/操作说明）、退出入口（返回标题）。在 S-xx story 中实现。
 */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    // TODO(S-05): Menu 必需要素
  }
}
