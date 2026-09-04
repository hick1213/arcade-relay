import Phaser from 'phaser';
import { InputRouter } from '../systems/input/InputRouter';
import { advanceRun, createInitialRun, handleTapEvent } from '../systems/runEngine';
import { TAP_EVENTS, type HudState, type RunEndSummary, type RunState, type TapEventName, type TapHit, type TextProvider } from '../types';
import { buildRunEndSummary } from '../systems/economy';
import { applyRunResult, createRunResult } from '../systems/meta/metaProgression';
import { loadSaveData, saveSaveData } from '../persistence/SaveAdapter';
import { createRunSnapshot, createResumeRun } from '../systems/runEngine';
import { createTextProvider } from '../systems/i18n';
import { Hud } from '../ui/Hud';
import { PausePanel } from '../ui/PausePanel';
import { GameplayView } from '../ui/GameplayView';
import { audioDirector } from '../ui/AudioDirector';
import { bgmKeyForRun, collectAudioCues } from '../systems/audio/audioTriggers';

/**
 * GameScene — 周目内游戏画面（晨/日/夜三段在场景内状态机推进，无场景跳跃）。
 *
 * Scene 保持轻薄（tech-stack.md 规范 3）: 周目内状态の真值は systems/runEngine（纯逻辑）、
 * 显示は ui/GameplayView・Hud（受けて描くだけ）、点击仲裁は systems/input。
 * 本场景は createInitialRun / advanceRun / handleTapEvent の接线と Result 迁移のみを行う。
 */
export class GameScene extends Phaser.Scene {
  private router!: InputRouter;
  private hud!: Hud;
  private pausePanel!: PausePanel;
  private view!: GameplayView;
  private run: RunState = createInitialRun();
  /** 同一周目の二重 persist 抑止（S-14 — create 时重置） */
  private runResultPersisted = false;

  constructor() {
    super('Game');
  }

  create(): void {
    // 场景重建＝状态全リセット（重开时计时器/客人/岗位表/弃牌堆の泄漏なし — S-15 acceptance）。
    // Menu「继续周目」経由（resume: true）は run 快照から当日晨间へ復帰（S-04 快照の読み出し側）
    const sceneData = this.scene.settings.data as { readonly resume?: boolean } | undefined;
    const snapshot = sceneData?.resume === true ? loadSaveData().data.run : null;
    this.run = snapshot !== null ? createResumeRun(snapshot) : createInitialRun();
    this.runResultPersisted = false;

    // 点击输入唯一入口（S-01 InputRouter — tech-stack 规范 4 / conventions 规则 7）
    this.router = new InputRouter();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.router.handlePointerDown(pointer.x, pointer.y);
    });

    // 文案は systems/i18n の正式查表 provider（S-11。缺 key 回落中文＋warn 1 次）
    const textProvider: TextProvider = createTextProvider();

    this.pausePanel = new PausePanel(this, textProvider, this.router, {
      // 「结束周目」= 破产/终战判定の自動迁移（runEngine.ended）と並ぶ手動経路
      onEndRun: () => this.goToResult(buildRunEndSummary(this.run, 'runComplete')),
      onQuitToMenu: () => this.scene.start('Menu'),
    });
    this.hud = new Hud(this, textProvider, this.router, () => this.pausePanel.open());
    this.view = new GameplayView(this, textProvider, this.router);

    this.router.on(TAP_EVENTS.AMBITION_CONFIRM, (hit) => this.applyTap(hit));
    this.router.on(TAP_EVENTS.ASSIGN_SLOT, (hit) => this.applyTap(hit));
    this.router.on(TAP_EVENTS.STAFF, (hit) => this.applyTap(hit));
    this.router.on(TAP_EVENTS.OPEN_DOOR, (hit) => this.applyTap(hit));
    this.router.on(TAP_EVENTS.TABLE_ORDER, (hit) => this.applyTap(hit));
    this.router.on(TAP_EVENTS.SERVE_WINDOW, (hit) => this.applyTap(hit));
    this.router.on(TAP_EVENTS.PAYMENT_BUBBLE, (hit) => this.applyTap(hit));
    this.router.on(TAP_EVENTS.EVENT_CARD_DRAW, (hit) => this.applyTap(hit));
    this.router.on(TAP_EVENTS.EVENT_CARD_OPTION, (hit) => this.applyTap(hit));
    this.router.on(TAP_EVENTS.DAYBREAK, (hit) => this.applyTap(hit));

    this.view.render(this.run);
    this.hud.update(this.toHudState());

    // 音频接线（S-27）: 音量初期值 = SaveData.settings、BGM 轨道 = 初期相位
    // （第 20 日夜 resume 時は BGM-02。autoplay 制限下では AudioDirector が退避）。
    const settings = loadSaveData().data.settings;
    audioDirector.attach(this, settings.bgm_volume, settings.sfx_volume);
    audioDirector.requestBgm(bgmKeyForRun(this.run));
  }

  update(_time: number, delta: number): void {
    // 志向选择相位は player 操作のみで進む（delta 计时の対象外 — gdd「一日相位控制器」）
    if (this.run.phase === 'ambition') {
      return;
    }
    // 暂停面板开启中: 全部相位推进停止（gdd: 面板开启时计时暂停、其他点击被屏蔽）
    if (this.pausePanel.isOpen) {
      return;
    }
    const prev = this.run;
    this.run = advanceRun(this.run, delta);
    this.syncAudio(prev);
    this.syncView(delta);
  }

  private applyTap(hit: TapHit): void {
    const previousPhase = this.run.phase;
    const prev = this.run;
    this.run = handleTapEvent(this.run, hit);
    // 志向确认の瞬間に run 快照を SaveData へ書き出し（S-04 acceptance）
    if (previousPhase === 'ambition' && this.run.phase !== 'ambition') {
      this.persistRunSnapshot();
    }
    this.syncAudio(prev, hit.event);
    this.syncView();
  }

  /**
   * 音频接线（S-27）: 迁移差分＋tap → SFX cue 再生与 BGM 轨道更新。
   * 「何を鳴らすか」の判定は systems/audio/audioTriggers（纯逻辑 — Scene 薄薄）、
   * 出力は ui/AudioDirector（音量真值 = SaveData.settings の表示キャッシュ経由）。
   */
  private syncAudio(prev: RunState, tapEvent: TapEventName | null = null): void {
    for (const cue of collectAudioCues(prev, this.run, tapEvent)) {
      audioDirector.playSfx(cue.key, cue.variant ?? undefined);
    }
    audioDirector.requestBgm(bgmKeyForRun(this.run));
  }

  /** 志向确定 → run 快照を SaveData.run へ（Menu「继续周目」の表示条件 — S-04） */
  private persistRunSnapshot(): void {
    const loaded = loadSaveData();
    saveSaveData({ ...loaded.data, run: createRunSnapshot(this.run) });
  }

  /** 破产/周目终结の自動迁移 → Result（runEngine.ended が真値 — S-08/S-15） */
  private syncView(delta = 0): void {
    if (this.run.ended !== null) {
      this.goToResult(this.run.ended);
      return;
    }
    this.view.render(this.run, delta);
    this.hud.update(this.toHudState());
  }

  private toHudState(): HudState {
    return { silver: this.run.silver, reputation: this.run.reputation, day: this.run.day };
  }

  private goToResult(summary: RunEndSummary): void {
    // 新纪录标记（S-25）の基準値 — applyRunResult による best_score 更新の前に取得
    const bestScoreBefore = loadSaveData().data.best_score;
    this.persistRunResult(summary);
    this.scene.start('Result', { ...summary, bestScoreBefore });
  }

  /**
   * 周目终结 → applyRunResult → 立即 persist 1 次（S-14 / gdd「存档数据方针」保存时机）。
   * - 终战败は run 快照保留（重试当日 = S-19 接线）のため適用しない —
   *   「回到菜单／再来一周目」时に適用される（S-19 で Result 側へ接线）。
   * - applyRunResult は run := null にするため連続重開でも同じ 1 回の終局しか反映しない
   *   （场景 flag で同一周目の二重 persist も抑止）。
   */
  private persistRunResult(summary: RunEndSummary): void {
    if (summary.kind === 'finalBattleLoss' || this.runResultPersisted) {
      return;
    }
    this.runResultPersisted = true;
    const loaded = loadSaveData();
    saveSaveData(applyRunResult(loaded.data, createRunResult(summary)));
  }
}
