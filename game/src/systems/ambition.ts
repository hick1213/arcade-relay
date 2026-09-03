/**
 * ambition — 志向参数包（gdd「志向系统」: 初始资源/事件偏移の参数化）。
 * 纯函数・Phaser 非依赖。S-04: 新周目は志向选择から开局 —
 * 选择 UI（ui/GameplayView の ambition 相位）からの確定值は runEngine.confirmAmbition 経由。
 */
import { AMBITION } from '../config';
import type { AmbitionId } from '../types';

export interface AmbitionPack {
  readonly id: AmbitionId;
  readonly silverStart: number;
  readonly reputationStart: number;
}

/** 志向 id 一览（選択ボタンの表示順 = gdd「志向系统」の記載順: 財/侠/名） */
export const AMBITION_ORDER: readonly AmbitionId[] = ['wealth', 'xia', 'fame'];

/** 志向别开局初期值の一括取得（S-04 選択 UI が 3 候補の初期值表示に使用） */
export const AMBITION_PACKS: readonly AmbitionPack[] = AMBITION_ORDER.map(getAmbitionPack);

export function getAmbitionPack(id: AmbitionId): AmbitionPack {
  const start = AMBITION.START[id];
  return { id, silverStart: start.silver, reputationStart: start.reputation };
}

/** 任意值（存档快照・tap payload）の志向 id 検査（runEngine.createResumeRun 用の窄化） */
export function isAmbitionId(value: unknown): value is AmbitionId {
  return (
    typeof value === 'string' && AMBITION_ORDER.includes(value as AmbitionId)
  );
}
