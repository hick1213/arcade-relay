/**
 * ambition — 志向参数包（gdd「志向系统」: 初始资源/事件偏移の参数化）。
 * 志向选择 UI は story S-04 で接线 — 現段階では config.AMBITION.DEFAULT_ID で开局（判断事項）。
 * 纯函数・Phaser 非依赖。
 */
import { AMBITION } from '../config';
import type { AmbitionId } from '../types';

export interface AmbitionPack {
  readonly id: AmbitionId;
  readonly silverStart: number;
  readonly reputationStart: number;
}

export function getAmbitionPack(id: AmbitionId): AmbitionPack {
  const start = AMBITION.START[id];
  return { id, silverStart: start.silver, reputationStart: start.reputation };
}
