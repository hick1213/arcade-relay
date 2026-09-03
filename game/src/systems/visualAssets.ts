/**
 * visualAssets — IMG 资产と游戏实体（相位/伙计/客人/菜品/志向）の対応づけ（S-33）。
 *
 * - systems 层（tech-stack 规范 3）: config の键参照と数值写像のみ。Phaser は import しない。
 * - 键の权威は config.ASSET_KEYS.images（design/assets.md IMG-01～30 の登记处）。
 * - 客人の 3 種割当（散客/镖师/老饕）は customer.id の循环写像 — S-16 が客人種別を
 *   RunState に持つようになった場合は、その種別での写像へ差し替えること（判断事項として報告済み）。
 */
import { ASSET_KEYS } from '../config';
import type { AmbitionId, Phase } from '../types';

/** 菜品图标（IMG-15～20。菜号 1–6 = 配列順 — KITCHEN.DISH_COUNT と同長を保つ） */
const DISH_SPRITE_KEYS: readonly string[] = [
  ASSET_KEYS.images.dish1,
  ASSET_KEYS.images.dish2,
  ASSET_KEYS.images.dish3,
  ASSET_KEYS.images.dish4,
  ASSET_KEYS.images.dish5,
  ASSET_KEYS.images.dish6,
];

/** 客人立绘（IMG-11～13。customer.id を 3 種に循环割当 — 同一客は常に同一種） */
const GUEST_SPRITE_KEYS: readonly string[] = [
  ASSET_KEYS.images.guestCommoner,
  ASSET_KEYS.images.guestEscort,
  ASSET_KEYS.images.guestGourmet,
];

/** 伙计 id → 立绘（IMG-04～10。キー = STAFF_ROSTER.id。IMG-09/10 = UNL-01/02 解锁伙计） */
const STAFF_SPRITE_KEYS: Readonly<Record<string, string>> = {
  afu: ASSET_KEYS.images.staffAfu,
  tieniu: ASSET_KEYS.images.staffTieniu,
  wenqu: ASSET_KEYS.images.staffWenqu,
  xiaodie: ASSET_KEYS.images.staffXiaodie,
  dasong: ASSET_KEYS.images.staffDasong,
  liubiaotou: ASSET_KEYS.images.staffLiubiaotou,
  suyuchu: ASSET_KEYS.images.staffSuyuchu,
};

const AMBITION_ICON_KEYS: Readonly<Record<AmbitionId, string>> = {
  wealth: ASSET_KEYS.images.ambitionWealth,
  xia: ASSET_KEYS.images.ambitionXia,
  fame: ASSET_KEYS.images.ambitionRenown,
};

/** 相位 → 背景资产键（IMG-01/02/03。ambition = 新周目开局は晨の背景 — gdd「一日相位」） */
export function backgroundKeyForPhase(phase: Phase): string {
  switch (phase) {
    case 'day':
      return ASSET_KEYS.images.bgInnDay;
    case 'night':
      return ASSET_KEYS.images.bgInnNight;
    default:
      return ASSET_KEYS.images.bgInnMorning;
  }
}

/** 伙计 id → 立绘资产键。未登记 id（存在しないはず）は null — 呼出側はスプライトを省略 */
export function staffSpriteKey(staffId: string): string | null {
  return STAFF_SPRITE_KEYS[staffId] ?? null;
}

/** 客人 → 立绘资产键（id は 1 起始 — 3 種が均等に割れるよう 1 起点の循环） */
export function guestSpriteKey(customerId: number): string {
  const index = (customerId + GUEST_SPRITE_KEYS.length - 1) % GUEST_SPRITE_KEYS.length;
  return GUEST_SPRITE_KEYS[index] as string;
}

/** 菜号（1–6）→ 菜品图标资产键。範囲外は菜号帯にクランプ（登場しないはずの防御） */
export function dishSpriteKey(dishId: number): string {
  const clamped = Math.max(1, Math.min(DISH_SPRITE_KEYS.length, dishId));
  return DISH_SPRITE_KEYS[clamped - 1] as string;
}

/** 志向 → 图标资产键（IMG-22～24） */
export function ambitionIconKey(ambitionId: AmbitionId): string {
  return AMBITION_ICON_KEYS[ambitionId];
}
