/**
 * UI 占位纹理的程序化生成（S-10）。
 * 图像资产（IMG-xx）生成中 — 先以 Graphics.generateTexture 生成面板/按钮底板，
 * 键名经 config.ts 的 ASSET_KEYS.uiPlaceholder 登记，资产到位后仅替换 ASSET_KEYS 与加载处。
 */
import Phaser from 'phaser';
import { ASSET_KEYS, MENU, RESULT, UI } from '../config';

type PanelDrawer = (g: Phaser.GameObjects.Graphics, width: number, height: number) => void;

/** 深棕面板＋墨褐描边＋金色 accent 线（art-bible 调色板。参数全部来自 config.UI） */
const drawPanelBase: PanelDrawer = (g, width, height) => {
  g.fillStyle(UI.PANEL_FILL, UI.PANEL_FILL_ALPHA);
  g.fillRoundedRect(0, 0, width, height, UI.PANEL_RADIUS);
  g.lineStyle(UI.PANEL_STROKE_WIDTH, UI.PANEL_STROKE, 1);
  g.strokeRoundedRect(
    UI.PANEL_STROKE_WIDTH / 2,
    UI.PANEL_STROKE_WIDTH / 2,
    width - UI.PANEL_STROKE_WIDTH,
    height - UI.PANEL_STROKE_WIDTH,
    UI.PANEL_RADIUS,
  );
  g.lineStyle(UI.PANEL_ACCENT_WIDTH, UI.PANEL_ACCENT, 1);
  g.lineBetween(
    UI.PANEL_ACCENT_INSET,
    height - UI.PANEL_ACCENT_INSET,
    width - UI.PANEL_ACCENT_INSET,
    height - UI.PANEL_ACCENT_INSET,
  );
};

const ensureTexture = (
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: PanelDrawer,
): void => {
  if (scene.textures.exists(key)) {
    return;
  }
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g, width, height);
  g.generateTexture(key, width, height);
  g.destroy();
};

/** 幂等生成: 已存在则跳过（同一 Scene 重建时安全） */
export const ensureUiPlaceholderTextures = (scene: Phaser.Scene): void => {
  ensureTexture(
    scene,
    ASSET_KEYS.uiPlaceholder.hudChip,
    UI.HUD_CHIP_WIDTH,
    UI.HUD_CHIP_HEIGHT,
    drawPanelBase,
  );
  ensureTexture(
    scene,
    ASSET_KEYS.uiPlaceholder.ledgerButton,
    UI.HUD_LEDGER_WIDTH,
    UI.HUD_LEDGER_HEIGHT,
    drawPanelBase,
  );
  ensureTexture(
    scene,
    ASSET_KEYS.uiPlaceholder.pausePanel,
    UI.PAUSE_PANEL_WIDTH,
    UI.PAUSE_PANEL_HEIGHT,
    drawPanelBase,
  );
  ensureTexture(
    scene,
    ASSET_KEYS.uiPlaceholder.pauseButton,
    UI.PAUSE_BUTTON_WIDTH,
    UI.PAUSE_BUTTON_HEIGHT,
    drawPanelBase,
  );
  ensureTexture(
    scene,
    ASSET_KEYS.uiPlaceholder.menuButton,
    MENU.BUTTON_WIDTH,
    MENU.BUTTON_HEIGHT,
    drawPanelBase,
  );
  ensureTexture(
    scene,
    ASSET_KEYS.uiPlaceholder.menuPanel,
    MENU.PANEL_WIDTH,
    MENU.PANEL_HEIGHT,
    drawPanelBase,
  );
  ensureTexture(
    scene,
    ASSET_KEYS.uiPlaceholder.resultPanel,
    RESULT.PANEL_WIDTH,
    RESULT.PANEL_HEIGHT,
    drawPanelBase,
  );
};
