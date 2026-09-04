import Phaser from 'phaser';
import { ASSET_KEYS, RESULT_FALLBACK_SUMMARY } from '../config';
import { InputRouter } from '../systems/input/InputRouter';
import { createTextProvider } from '../systems/i18n';
import { loadSaveData } from '../persistence/SaveAdapter';
import type { RunEndSummary, TextProvider } from '../types';
import { ResultPanel } from '../ui/ResultPanel';

/**
 * ResultScene — 结果画面（S-15 场景循环闭合 + S-25 结局演出完整版）。
 *
 * - 显示败局（破产 = 账本合上演出 / 终战败 = 朱 flash＋SFX-08）或结局（S-20 判定値
 *   RunEndSummary.ending → 结局插画 IMG-26～28＋结局文）与总评分细目 — 显示全部委托
 *   ui/ResultPanel（Scene 轻薄）。新纪录标记も同様（bestScoreBefore は迁移方が付与）。
 * - 「再来一周目」→ GameScene 志向选择（scene.start 全量重建 — 计时器/客人/岗位表/弃牌堆
 *   等周目内状态无泄漏; 仅元进度跨周目继承）。
 * - 「回到菜单」→ MenuScene。
 * - 迁移载荷 RunEndSummary 由迁移方（GameScene.goToResult — Systems 层の破产/终战/结局判定）
 *   传入; 缺省时以 RESULT_FALLBACK_SUMMARY 占位（UI 不生成周目数值）。
 *   applyRunResult→persist の接线は GameScene（S-14/S-19）职责 — 本场景は演出用 SFX の
 *   再生（接线層の音频 output）のみを行い、存档 I/O は触碰しない（読み取りは音量の取得のみ）。
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

    // 文案は systems/i18n の正式查表 provider（S-11。缺 key 回落中文＋warn 1 次）
    const textProvider: TextProvider = createTextProvider();
    const summary = data ?? RESULT_FALLBACK_SUMMARY;

    new ResultPanel(this, textProvider, this.router, summary, {
      onRetry: () => this.scene.start('Game'),
      onToMenu: () => this.scene.start('Menu'),
      // 破产演出「账本合上」の瞬间 → SFX-07（音量は SaveData.settings — persistence 層経由の取得）
      onLedgerClosed: () => this.playResultSfx(ASSET_KEYS.audio.sfxAbacusLedger),
      // 终战败演出の開始瞬间 → SFX-08
      onDefeatSting: () => this.playResultSfx(ASSET_KEYS.audio.sfxBattleGong),
    });
  }

  /** 演出 SFX（SFX-07/08）。ユーザー操作済みの遷移後のため通常 unlocked。
   *  locked の場合も静かに捨てない（S-25 fix: unlock() は非同期のため即 play すると
   *  内部 warn のみで無音になる）— unlocked 発効後に確実に再生する */
  private playResultSfx(key: string): void {
    const volume = loadSaveData().data.settings.sfx_volume;
    if (!this.sound.locked) {
      this.sound.play(key, { volume });
      return;
    }
    this.sound.once(Phaser.Sound.Events.UNLOCKED, () => {
      this.sound.play(key, { volume });
    });
    this.sound.unlock();
  }
}
