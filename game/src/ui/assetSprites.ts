/**
 * assetSprites — IMG 资产の表示ヘルパ（S-33。Phaser 依存は ui/ 層に封閉 — tech-stack.md）。
 *
 * - スプライトの「 how に置くか」（cover 裁切・等比縮小）だけを担い、
 *   「何を置くか」（実体 ↔ 資産キーの対応）は systems/visualAssets.ts の权威に従う。
 * - すべてのキーは config.ASSET_KEYS 経由で呼出側が渡す（規範 5: 硬编码パス禁止）。
 */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';

/**
 * 背景资产を全画面に cover 裁切で配置（assets.md: 1536x1024 → 1280x720。
 * 短い辺を基准に等比拡大し、はみ出た分は画面外 — アスペクト比は維持される）。
 */
export function addCoverBackground(scene: Phaser.Scene, key: string): Phaser.GameObjects.Image {
  const image = scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, key);
  const scale = Math.max(GAME_WIDTH / image.width, GAME_HEIGHT / image.height);
  image.setDisplaySize(image.width * scale, image.height * scale);
  return image;
}

/** 立绘/物件を指定の表示高さで等比配置（縦横比維持 — 关键轮廓を裁切らない） */
export function addScaledSprite(
  scene: Phaser.Scene,
  key: string,
  x: number,
  y: number,
  displayHeight: number,
): Phaser.GameObjects.Image {
  const image = scene.add.image(x, y, key);
  image.setDisplaySize((image.width * displayHeight) / image.height, displayHeight);
  return image;
}
