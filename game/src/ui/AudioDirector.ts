/**
 * AudioDirector — 音频输出的唯一接线层（S-27）。
 *
 * - BGM: 场景/相位 → 轨道的选择は systems/audio/audioTriggers.bgmKeyForRun（纯逻辑）、
 *   循环播放/轨道切换/音量適用を本クラスが担う。同一轨道の再要求は no-op
 *   （Title→Menu→Game の场景迁移で音楽が途切れない。loop: true — S-31 循环検証済み资产）。
 * - SFX: playSfx(key, variant?)。复用变调（detune/rate/volumeScale）は config.AUDIO.SFX_VARIANTS。
 * - 音量の真值 = SaveData.settings（conventions 规则 8）。本クラスは最後の適用值の
 *   表示キャッシュのみ保持（Menu 设置 UI → setVolumes → 実時反映。UI 側の独立状态は持たない）。
 * - autoplay 应对（tech-stack 规范 6）: locked 中の BGM/SFX 要求は pending に退避し、
 *   首次ユーザー入力で Phaser SoundManager が発火する UNLOCKED 後に再生する
 *   （unlock 操作自体は TitleScene の首次输入で実施 — scenes 側の責務）。
 *
 * Phaser 依存は scenes/ ui/ main.ts に封じる規範により本ファイルは ui/ に置く
 * （systems/ は Phaser を import しない — gameplay-code rule）。
 */
import Phaser from 'phaser';
import { AUDIO, DEFAULT_SETTINGS } from '../config';
import type { SfxVariantId } from '../config';
import type { SfxCue } from '../systems/audio/audioTriggers';

export class AudioDirector {
  private manager: Phaser.Sound.BaseSoundManager | null = null;
  private bgmSound: Phaser.Sound.BaseSound | null = null;
  private bgmKey: string | null = null;
  private pendingBgmKey: string | null = null;
  private pendingSfx: readonly SfxCue[] = [];
  /** 最後に適用した音量（表示キャッシュ。真值 = SaveData.settings） */
  private bgmVolume: number = DEFAULT_SETTINGS.bgm_volume;
  private sfxVolume: number = DEFAULT_SETTINGS.sfx_volume;

  /**
   * SoundManager を束ねる（最初の 1 回のみ有効、以降 no-op — 场景 create から毎回呼んでも安全）。
   * 音量の初期值は呼び出し側が SaveData.settings から渡す（persistence 経由の取得）。
   */
  attach(scene: Phaser.Scene, bgmVolume: number, sfxVolume: number): void {
    if (this.manager !== null) {
      return;
    }
    this.manager = scene.sound;
    this.bgmVolume = bgmVolume;
    this.sfxVolume = sfxVolume;
    if (scene.sound.locked) {
      // 首次ユーザー入力まで BGM/SFX 要求を退避（autoplay 制限 — tech-stack 规范 6）
      scene.sound.once(Phaser.Sound.Events.UNLOCKED, () => this.flushPending());
    }
  }

  /** Menu 设置 UI の变更を音声出力へ実時反映（値は GameScene/MenuScene が SaveData へ永続化） */
  setVolumes(bgmVolume: number, sfxVolume: number): void {
    this.setBgmVolume(bgmVolume);
    this.setSfxVolume(sfxVolume);
  }

  /** BGM 音量（再生中の BGM へ即時適用 — QA-PLAY 要点 2 の音量实效検証対象） */
  setBgmVolume(value: number): void {
    this.bgmVolume = value;
    if (this.bgmSound !== null) {
      this.applyBgmVolume(value);
    }
  }

  /** SFX 音量（次回の playSfx から適用 — SFX は短音のため常時鳴りっぱなしの音が無い） */
  setSfxVolume(value: number): void {
    this.sfxVolume = value;
  }

  /** BGM 轨道を要求（同一轨道は no-op。locked 中は pending 退避） */
  requestBgm(key: string): void {
    if (this.bgmKey === key && this.bgmSound !== null) {
      return;
    }
    if (this.manager === null || this.manager.locked) {
      this.pendingBgmKey = key;
      return;
    }
    this.stopBgm();
    this.bgmKey = key;
    // add + play（参照保持）— manager.play は COMPLETE 時 destroy 前提の PaaS のため
    // ループ音は明示的に stop/remove して資産させる
    const sound = this.manager.add(key, { loop: true, volume: this.bgmVolume });
    sound.play();
    this.bgmSound = sound;
  }

  /** BGM 停止（参照を破棄 — manager.play の自動 destroy に頼らない明示管理） */
  stopBgm(): void {
    if (this.bgmSound !== null && this.manager !== null) {
      this.bgmSound.stop();
      this.manager.remove(this.bgmSound);
    }
    this.bgmSound = null;
    this.bgmKey = null;
  }

  /** SFX 再生（复用变调变体あり）。locked 中は pending 退避（UNLOCKED 後に再生） */
  playSfx(key: string, variant?: SfxVariantId): void {
    if (this.manager === null) {
      return;
    }
    if (this.manager.locked) {
      this.pendingSfx = [...this.pendingSfx, { key, variant: variant ?? null }];
      return;
    }
    this.playSfxNow(key, variant);
  }

  private playSfxNow(key: string, variant?: SfxVariantId): void {
    if (this.manager === null) {
      return;
    }
    if (variant !== undefined) {
      const tuned = AUDIO.SFX_VARIANTS[variant];
      const volume = Math.min(AUDIO.SFX_VOLUME_MAX, this.sfxVolume * tuned.volumeScale);
      this.manager.play(key, { volume, detune: tuned.detune, rate: tuned.rate });
      return;
    }
    this.manager.play(key, { volume: this.sfxVolume });
  }

  /**
   * 再生中 BGM への音量適用。Phaser 3.90 の WebAudioSound#volume setter は
   * `setValueAtTime(value, 0)` を每回スケジュールし、timeline 上の既存イベントと同時刻
   * （またはより早い時刻）の重複スケジュールは Chromium が靜かに無視する — MenuScene の
   * masterVolumeNode と同型の落とし穴。先に cancel してから現在時刻で再スケジュールする。
   * WebAudio 以外（HTML5/NoAudio）は volumeNode を持たないため通常の setter。
   */
  private applyBgmVolume(value: number): void {
    const sound = this.bgmSound as Phaser.Sound.WebAudioSound;
    const manager = this.manager as Phaser.Sound.WebAudioSoundManager;
    if (sound.volumeNode !== undefined && manager.context !== undefined) {
      const gain = sound.volumeNode.gain;
      gain.cancelScheduledValues(manager.context.currentTime);
      gain.setValueAtTime(value, manager.context.currentTime);
    } else {
      sound.setVolume(value);
    }
  }

  /** UNLOCKED（首次ユーザー入力）発火後: 退避しておいた BGM/SFX 要求を再生 */
  private flushPending(): void {
    if (this.pendingBgmKey !== null) {
      const key = this.pendingBgmKey;
      this.pendingBgmKey = null;
      this.bgmKey = null;
      this.requestBgm(key);
    }
    const sfx = this.pendingSfx;
    this.pendingSfx = [];
    sfx.forEach((item) => this.playSfxNow(item.key, item.variant ?? undefined));
  }
}

/** モジュール单例 — SoundManager は Phaser.Game 単位のため场景を跨いで共有する */
export const audioDirector = new AudioDirector();
