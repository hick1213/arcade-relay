import Phaser from 'phaser';
import { ASSET_KEYS, RESULT_FALLBACK_SUMMARY } from '../config';
import { InputRouter } from '../systems/input/InputRouter';
import { createTextProvider } from '../systems/i18n';
import { loadSaveData, saveSaveData } from '../persistence/SaveAdapter';
import { applyRunResult, createRunResult } from '../systems/meta/metaProgression';
import type { RunEndSummary, TextProvider } from '../types';
import { audioDirector } from '../ui/AudioDirector';
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
 *   applyRunResult→persist の接线は GameScene（S-14/S-19）职责。本场景は演出用 SFX の再生
 *   （接线層の音频 output）と、终战败「回到菜单」時の周目终结 persist（S-19 — I/O は
 *   persistence 层経由の純 reducer 呼び出しのみ）を行う（読み取りは音量の取得）。
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

    // 音频接线（S-27）: BGM-01（基础氛围の継続。终战败の待機 = assets.md BGM-02 用途の
    // 「重试时的待机」→ BGM-02 継続）。locked 中は AudioDirector が退避（UNLOCKED 後に再生）。
    const settings = loadSaveData().data.settings;
    audioDirector.attach(this, settings.bgm_volume, settings.sfx_volume);
    audioDirector.requestBgm(
      summary.kind === 'finalBattleLoss'
        ? ASSET_KEYS.audio.bgmFinalBattle
        : ASSET_KEYS.audio.bgmInnDay,
    );
    // 破产败局 = SFX-06 低速变调（assets.md「复用映射」。演出 SFX は S-25 の退避方針どおり
    // AudioDirector 側で locked 時は UNLOCKED 後に再生）
    if (summary.kind === 'bankruptcy') {
      audioDirector.playSfx(ASSET_KEYS.audio.sfxFailLeave, 'bankruptcy');
    }

    new ResultPanel(this, textProvider, this.router, summary, {
      // 终战败（S-19）: 「重试当日」→ 開戦前快照を GameScene へ渡して第 20 日夜から再開。
      // 他 kind は「再来一周目」→ 志向选择（payload なし = 新周目）。
      onRetry: () =>
        this.scene.start(
          'Game',
          summary.preBattleSnapshot ? { retryFinalBattle: summary.preBattleSnapshot } : undefined,
        ),
      // 终战败で「回到菜单」を選んだ时点で周目终结 — applyRunResult → persist 1 次
      // （run := null。gdd「存档数据方针」: Menu に「继续周目」を残さない — S-19 接线）。
      // 他 kind は GameScene.persistRunResult 済みのため二重適用しない。
      onToMenu: () => {
        this.abandonFinalBattleLoss(summary);
        this.scene.start('Menu');
      },
      // 破产演出「账本合上」の瞬间 → SFX-07（音量は AudioDirector の表示キャッシュ =
      // SaveData.settings。persistence 層経由の取得）
      onLedgerClosed: () => audioDirector.playSfx(ASSET_KEYS.audio.sfxAbacusLedger),
      // 终战败演出の開始瞬间 → SFX-08
      onDefeatSting: () => audioDirector.playSfx(ASSET_KEYS.audio.sfxBattleGong),
    });
  }

  /**
   * 终战败の放置（「回到菜单」選択時 — S-19）: applyRunResult → 立即 persist 1 次
   * （run := null — Menu「继续周目」が死周目を复活させないため。gdd「存档数据方针」）。
   * applyRunResult→persist の接线は GameScene（S-14）と本场景（S-19）の职责。純 reducer 呼び出し
   * のみで I/O は persistence 层経由。终战败以外は GameScene 済みのため何もしない。
   */
  private abandonFinalBattleLoss(summary: RunEndSummary): void {
    if (summary.kind !== 'finalBattleLoss') {
      return;
    }
    const loaded = loadSaveData();
    saveSaveData(applyRunResult(loaded.data, createRunResult(summary)));
  }
}
