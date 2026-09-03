import Phaser from 'phaser';

/**
 * GameScene — 周目内游戏画面（晨/日/夜三段在场景内状态机推进，无场景跳跃）。
 * Scene 保持轻薄（tech-stack.md 规范 3）: 逻辑全部委托给 systems/ 的纯逻辑模块。
 */
export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create(): void {
    // TODO(S-03 等): 一日相位控制器接线
  }

  update(_time: number, _delta: number): void {
    // delta-time 必须用于计时与移动（tech-stack.md 规范 2）
  }
}
