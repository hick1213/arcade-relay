/**
 * SaveAdapter — 持久化 I/O 层（tech-stack.md 规范 9 / conventions 规则 5:
 * localStorage 的唯一引用处。systems/ scenes/ ui/ 一律经本模块读写）。
 *
 * - 键: SAVE_KEY（arcaderelay-save）、首字段 save_version（contract §6）。
 * - 迁移与 schema 验证 = systems/meta/metaSchema.ts（权威）— 本模块只做 I/O 与损坏协议。
 * - 损坏协议（contract §6 三件套 — 禁止静默初始化）: 解析失败 / save_version 缺失・未来版本 /
 *   schema 验证失败 → (1) 原始数据备份到 `${SAVE_BACKUP_PREFIX}<epoch>` →
 *   (2) `[SaveCorruption]` error 恰好 1 次 → (3) 默认值重建 + recovered=true 传播到 UI 层。
 * - Storage 参数可注入（测试用内存 Storage mock — tech-stack「测试规范」）。
 */
import { SAVE_BACKUP_PREFIX, SAVE_KEY } from '../config';
import { createDefaultSaveData, migrateSaveData } from '../systems/meta/metaSchema';
import type { SaveData } from '../systems/meta/metaTypes';

export interface SaveLoadResult {
  readonly data: SaveData;
  /** 仅存档损坏恢复会话中为 true（UI 层显示 1 次通知） */
  readonly recovered: boolean;
}

/** 损坏处理: .bak 备份 + [SaveCorruption] 日志 1 次 + 默认值重建（contract §6 三件套） */
const recoverCorrupted = (storage: Storage, raw: string, reason: string): SaveLoadResult => {
  const backupKey = `${SAVE_BACKUP_PREFIX}${Date.now()}`;
  try {
    storage.setItem(backupKey, raw);
  } catch (error) {
    console.error(`[SaveCorruption] reason=${reason} backup-write-failed=${String(error)}`);
    return { data: createDefaultSaveData(), recovered: true };
  }
  console.error(`[SaveCorruption] reason=${reason} backup=${backupKey}`);
  return { data: createDefaultSaveData(), recovered: true };
};

/** 存档读取。键不存在 = 首次启动（非损坏 — recovered=false 的默认值） */
export const loadSaveData = (storage: Storage = globalThis.localStorage): SaveLoadResult => {
  let raw: string | null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch (error) {
    console.error(`[SaveCorruption] reason=storage-unreadable detail=${String(error)}`);
    return { data: createDefaultSaveData(), recovered: true };
  }
  if (raw === null) {
    return { data: createDefaultSaveData(), recovered: false };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return recoverCorrupted(storage, raw, 'parse-failed');
  }
  const result = migrateSaveData(parsed);
  if (!result.ok) {
    return recoverCorrupted(storage, raw, result.reason);
  }
  return { data: result.data, recovered: false };
};

/**
 * 存档写入（设置变更 / 周目终结 applyRunResult 等的唯一直写出口）。
 * recovered 是会话内标志 — 持久化快照恒 false（下次启动不应再次显示恢复通知）。
 */
export const saveSaveData = (data: SaveData, storage: Storage = globalThis.localStorage): void => {
  storage.setItem(SAVE_KEY, JSON.stringify({ ...data, recovered: false }));
};
