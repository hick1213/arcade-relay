import Phaser from 'phaser';
import {
  ASSET_FALLBACK,
  ASSET_KEYS,
  AUDIO_FORMATS,
  IMG_SHEET_FRAME,
} from '../config';
import { loadSaveData } from '../persistence/SaveAdapter';
import { setLanguage } from '../systems/i18n';

/**
 * BootScene — 资产加载与存档初始加载。
 * 职责仅限: 经 ASSET_KEYS 加载 assets/（SFX + IMG 全量）、读取 SaveData（经 persistence 层）、
 * 然后迁移到 TitleScene。
 * 音频实际解锁（AudioContext resume）在 TitleScene 首次输入时进行 — 规范 6（autoplay 应对）。
 * IMG 资产が未落盘の場合（S-30 との合流前）は ASSET_FALLBACK の无地纹理を同一キーで
 * 登録し、以降の Scene/UI が欠落キーを参照しても描画が壊れないようにする（正常時は不発）。
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // SFX-01～08（tech-stack.md 规范 5: 路径只经 ASSET_KEYS。各键给 OGG+M4A 双 URL、
    // Phaser AudioFile 按 canPlay 自动择一，无扩展名硬编码的格式分支）
    Object.values(ASSET_KEYS.audio).forEach((basePath) => {
      this.load.audio(basePath, AUDIO_FORMATS.map((ext) => `${basePath}.${ext}`));
    });

    // IMG-01～29（键 = 路径 — config.ASSET_KEYS.images が唯一の登记处）
    Object.values(ASSET_KEYS.images).forEach((path) => {
      this.load.image(path, path);
    });

    // IMG-30 共通 UI sheet（程序化网格切分 — IMG_SHEET_FRAME。帧参照は ui/ 側）
    Object.values(ASSET_KEYS.spriteSheets).forEach((path) => {
      this.load.spritesheet(path, path, {
        frameWidth: IMG_SHEET_FRAME.WIDTH,
        frameHeight: IMG_SHEET_FRAME.HEIGHT,
      });
    });
  }

  create(): void {
    this.ensureImageFallbackTextures();
    // 言語の初期化（S-11）: SaveData.settings.lang を i18n モジュールへ反映してから Title へ。
    // 以後の全场景の文案查表はこの言語で行われる（ページリロード不要の即時切替の基準点）。
    setLanguage(loadSaveData().data.settings.lang);
    this.scene.start('Title');
  }

  /** ロード失敗/未同梱の IMG キーへ ASSET_FALLBACK 纹理を同一キーで登録（冪等） */
  private ensureImageFallbackTextures(): void {
    const imageKeys = [
      ...Object.values(ASSET_KEYS.images),
      ...Object.values(ASSET_KEYS.spriteSheets),
    ];
    imageKeys.forEach((key) => {
      if (this.textures.exists(key)) {
        return;
      }
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(ASSET_FALLBACK.FILL, 1);
      g.fillRect(0, 0, ASSET_FALLBACK.SIZE, ASSET_FALLBACK.SIZE);
      g.lineStyle(ASSET_FALLBACK.STROKE_WIDTH, ASSET_FALLBACK.STROKE, 1);
      g.strokeRect(0, 0, ASSET_FALLBACK.SIZE, ASSET_FALLBACK.SIZE);
      g.generateTexture(key, ASSET_FALLBACK.SIZE, ASSET_FALLBACK.SIZE);
      g.destroy();
    });
  }
}
