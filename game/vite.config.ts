import { defineConfig, type Plugin } from 'vite';
import { cpSync, existsSync, readFileSync, statSync } from 'node:fs';
import { join, normalize, resolve } from 'node:path';

/**
 * game/assets/（生成资产 + MANIFEST.jsonl — provenance 权威位置）は import されない生ファイルのため、
 * Vite は配信も dist コピーも行わない。ASSET_KEYS の値（config.ts。規範 5）は
 * 「assets/ 配下の実 URL」なので、その URL のまま配信するための最小プラグイン。
 * - dev: /assets/* を assets/ から配信（Content-Type は音频が通る最低限のみ）
 * - build: closeBundle で assets/ → dist/assets/ へ複製（vite preview が配信）
 * パストラバーサルガード付き。依存追加なし（tech-stack.md: ランタイム依存は Phaser のみ）。
 */
const ASSETS_URL_PREFIX = '/assets/';
const MIME_BY_EXT: Readonly<Record<string, string>> = {
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.json': 'application/json',
  '.jsonl': 'application/jsonl',
};

const serveGeneratedAssets = (): Plugin => {
  const assetsRoot = resolve(__dirname, 'assets');
  return {
    name: 'serve-generated-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0];
        if (!url.startsWith(ASSETS_URL_PREFIX)) {
          next();
          return;
        }
        const rel = normalize(decodeURIComponent(url.slice(ASSETS_URL_PREFIX.length)));
        const file = join(assetsRoot, rel);
        if (!file.startsWith(assetsRoot) || !existsSync(file) || !statSync(file).isFile()) {
          next();
          return;
        }
        const ext = rel.slice(rel.lastIndexOf('.'));
        res.setHeader('Content-Type', MIME_BY_EXT[ext] ?? 'application/octet-stream');
        res.end(readFileSync(file));
      });
    },
    closeBundle() {
      cpSync(assetsRoot, resolve(__dirname, 'dist', 'assets'), { recursive: true });
    },
  };
};

export default defineConfig({
  base: './',
  plugins: [serveGeneratedAssets()],
  build: {
    assetsInlineLimit: 0,
  },
  server: {
    host: true,
  },
});
