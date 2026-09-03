import Phaser from 'phaser';
import { RESULT_FALLBACK_SUMMARY } from '../config';
import { InputRouter } from '../systems/input/InputRouter';
import type { RunEndSummary, TextProvider } from '../types';
import { ResultPanel } from '../ui/ResultPanel';
import { createFallbackTextProvider } from '../ui/hudStrings';

/**
 * ResultScene — 结果画面（S-15: 场景循环闭合）。
 *
 * - 显示败局（破产 / 终战败）或周目结果与总评分（显示全部委托 ui/ResultPanel — Scene 轻薄）。
 * - 「再来一周目」→ GameScene 志向选择（scene.start 全量重建 — 计时器/客人/岗位表/弃牌堆
 *   等周目内状态无泄漏; 仅元进度跨周目继承）。
 * - 「回到菜单」→ MenuScene。
 * - 迁移载荷 RunEndSummary 由迁移方（Systems 层的破产/终战判定 — S-08/S-19）传入;
 *   缺省时以 RESULT_FALLBACK_SUMMARY 占位（UI 不生成周目数值）。
 *   applyRunResult→persist 的接线是 S-14（gameplay-engineer）职责 — 本场景不触碰存档 I/O。
 */
export class ResultScene extends Phaser.Scene {
  private router!: InputRouter;

  constructor() {
    super('Result');
  }

  create(data: RunEndSummary | undefined): void {
    // 点击输入唯一入口（S-01 InputRouter — tech-stack 规范 4 / conventions 规则 7）
    this.router = new InputRouter();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.router.handlePointerDown(pointer.x, pointer.y);
    });

    // TODO(S-11): systems/i18n 落地后替换为正式查表 provider（当前为 ui/hudStrings 的中文回落表）
    const textProvider: TextProvider = createFallbackTextProvider();
    const summary = data ?? RESULT_FALLBACK_SUMMARY;

    new ResultPanel(this, textProvider, this.router, summary, {
      onRetry: () => this.scene.start('Game'),
      onToMenu: () => this.scene.start('Menu'),
    });
  }
}
