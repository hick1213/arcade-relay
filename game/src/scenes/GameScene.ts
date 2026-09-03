import Phaser from 'phaser';
import { HUD_INITIAL_STATE } from '../config';
import { InputRouter } from '../systems/input/InputRouter';
import type { HudState, TextProvider } from '../types';
import { Hud } from '../ui/Hud';
import { PausePanel } from '../ui/PausePanel';
import { createFallbackTextProvider } from '../ui/hudStrings';

/**
 * GameScene — 周目内游戏画面（晨/日/夜三段在场景内状态机推进，无场景跳跃）。
 * Scene 保持轻薄（tech-stack.md 规范 3）: 逻辑全部委托给 systems/ 的纯逻辑模块。
 */
export class GameScene extends Phaser.Scene {
  private router!: InputRouter;
  private hud!: Hud;
  private pausePanel!: PausePanel;
  /** HUD 表示フィード（真值は Systems 层。S-04/S-08 接线后由此置換为 systems 状态 — UI 侧无副本） */
  private hudFeed: HudState = HUD_INITIAL_STATE;

  constructor() {
    super('Game');
  }

  create(): void {
    // 点击输入唯一入口（S-01 InputRouter — tech-stack 规范 4 / conventions 规则 7）
    this.router = new InputRouter();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.router.handlePointerDown(pointer.x, pointer.y);
    });

    // TODO(S-11): systems/i18n 落地后替换为正式查表 provider（当前为 ui/hudStrings 的中文回落表）
    const textProvider: TextProvider = createFallbackTextProvider();

    this.pausePanel = new PausePanel(this, textProvider, this.router, {
      onQuitToMenu: () => this.scene.start('Menu'),
    });
    this.hud = new Hud(this, textProvider, this.router, () => this.pausePanel.open());
    this.hud.update(this.hudFeed);
  }

  update(_time: number, _delta: number): void {
    // 暂停面板开启中: 全部相位推进停止（日间唯一硬计时 = systems dayCycle advance 的
    // S-03 接线必须位于本守卫之后 — gdd「输入」节: 面板开启时计时暂停、其他点击被屏蔽）
    if (this.pausePanel.isOpen) {
      return;
    }
    this.hud.update(this.hudFeed);
  }
}
