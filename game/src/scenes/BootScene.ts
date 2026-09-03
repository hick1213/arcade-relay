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
 * 欠落は CR-CODE iteration 1 の指摘どおり静默にせず、[AssetMissing] で console.error する
 * （fallback は合流までの过渡措置 — 失败キーは Checkpoint に報告される）。
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // 加载失败的可观测化（CR-CODE iteration 1 finding 2）: 静默 fallback は欠落を隠すため、
    // 失败キーを [AssetMissing] で明示する。検証は headless QA の console error 0 で拾われる。
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.error(`[AssetMissing] key=${file.key} url=${String(file.src)} — fallback 纹理で代替（Checkpoint 報告対象）`);
    });

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
    Object.values(ASSET_KEYS.images).forEach((key) => {
      if (!this.textures.exists(key)) {
        this.generateFallbackImageTexture(key);
      }
    });
    // sheet キー（CR-CODE iteration 1 finding 4）: 単帧プレーン纹理だと帧参照（0–5）が
    // 存在しない帧を刺すため、IMG_SHEET_FRAME のグリッド＝帧区画つきで生成する。
    Object.values(ASSET_KEYS.spriteSheets).forEach((key) => {
      if (!this.textures.exists(key)) {
        this.generateFallbackSheetTexture(key);
      }
    });
  }

  /** 单帧の无地プレート（image キー用） */
  private generateFallbackImageTexture(key: string): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(ASSET_FALLBACK.FILL, 1);
    g.fillRect(0, 0, ASSET_FALLBACK.SIZE, ASSET_FALLBACK.SIZE);
    g.lineStyle(ASSET_FALLBACK.STROKE_WIDTH, ASSET_FALLBACK.STROKE, 1);
    g.strokeRect(0, 0, ASSET_FALLBACK.SIZE, ASSET_FALLBACK.SIZE);
    g.generateTexture(key, ASSET_FALLBACK.SIZE, ASSET_FALLBACK.SIZE);
    g.destroy();
  }

  /** sheet キー用: IMG_SHEET_FRAME の COLS x ROWS グリッドを帧として登记した代用纹理 */
  private generateFallbackSheetTexture(key: string): void {
    const width = IMG_SHEET_FRAME.WIDTH * IMG_SHEET_FRAME.COLS;
    const height = IMG_SHEET_FRAME.HEIGHT * IMG_SHEET_FRAME.ROWS;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    let frame = 0;
    for (let row = 0; row < IMG_SHEET_FRAME.ROWS; row += 1) {
      for (let col = 0; col < IMG_SHEET_FRAME.COLS; col += 1) {
        // 帧区画を区別できるよう市松模様の明度差（フレーム番号の視認 — 欠落時の識別用）
        const alpha = ASSET_FALLBACK.CELL_ALPHAS[frame % ASSET_FALLBACK.CELL_ALPHAS.length];
        g.fillStyle(ASSET_FALLBACK.FILL, alpha);
        g.fillRect(col * IMG_SHEET_FRAME.WIDTH, row * IMG_SHEET_FRAME.HEIGHT, IMG_SHEET_FRAME.WIDTH, IMG_SHEET_FRAME.HEIGHT);
        g.lineStyle(ASSET_FALLBACK.STROKE_WIDTH, ASSET_FALLBACK.STROKE, 1);
        g.strokeRect(col * IMG_SHEET_FRAME.WIDTH, row * IMG_SHEET_FRAME.HEIGHT, IMG_SHEET_FRAME.WIDTH, IMG_SHEET_FRAME.HEIGHT);
        frame += 1;
      }
    }
    g.generateTexture(key, width, height);
    g.destroy();
    // 実资产と同じ帧索引（0–COLS*ROWS−1）を付与 — UI 側の帧参照が fallback でも成立する
    const texture = this.textures.get(key);
    let index = 0;
    for (let row = 0; row < IMG_SHEET_FRAME.ROWS; row += 1) {
      for (let col = 0; col < IMG_SHEET_FRAME.COLS; col += 1) {
        texture.add(index, 0, col * IMG_SHEET_FRAME.WIDTH, row * IMG_SHEET_FRAME.HEIGHT, IMG_SHEET_FRAME.WIDTH, IMG_SHEET_FRAME.HEIGHT);
        index += 1;
      }
    }
  }
}
