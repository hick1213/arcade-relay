/**
 * SaveAdapter — 持久化 I/O 层（tech-stack.md 规范 9 / conventions 规则 5:
 * localStorage 的唯一引用处。systems/ scenes/ ui/ 一律经本模块读写）。
 *
 * - 键: SAVE_KEY（arcaderelay-save）、首字段 save_version（contract §6）。
 * - 损坏协议: 解析失败 / save_version 缺失・未来版本 / schema 验证失败 →
 *   (1) 原始数据备份到 `${SAVE_BACKUP_PREFIX}<epoch>` → (2) `[SaveCorruption]` error 恰好 1 次 →
 *   (3) 默认值重建 + recovered=true 传播到 UI 层。禁止静默初始化。
 * - schema 验证暂时内联于本文件; S-14（systems/meta/metaSchema.ts）落地后迁移，
 *   本模块仅保留 I/O 与损坏协议。
 * - Storage 参数可注入（测试用内存 Storage mock — tech-stack「测试规范」）。
 */
import {
  DEFAULT_SETTINGS,
  SAVE_BACKUP_PREFIX,
  SAVE_KEY,
  SAVE_VERSION,
} from '../config';
import type {
  AchievementId,
  LanguageCode,
  SaveData,
  UnlockId,
} from '../types';

const ACHIEVEMENT_IDS: readonly AchievementId[] = [
  'ACH-01',
  'ACH-02',
  'ACH-03',
  'ACH-04',
  'ACH-05',
  'ACH-06',
];
const UNLOCK_IDS: readonly UnlockId[] = ['UNL-01', 'UNL-02'];
const LANGUAGES: readonly LanguageCode[] = ['zh', 'en', 'ja', 'ko', 'th'];
const ENDINGS_COUNT = 3;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** 音量为 0–1（gdd「存档数据方针」settings） */
const isVolume = (value: unknown): value is number =>
  isFiniteNumber(value) && value >= 0 && value <= 1;

/** 首次启动（无存档键）时的初始状态（gdd「存档数据方针」表） */
const defaultSaveData = (): SaveData => ({
  save_version: SAVE_VERSION,
  best_score: 0,
  stats: { finished_runs: 0, silver_peak: 0, rep_peak: 0, served_total: 0 },
  endings_seen: [false, false, false],
  achievements: {
    'ACH-01': false,
    'ACH-02': false,
    'ACH-03': false,
    'ACH-04': false,
    'ACH-05': false,
    'ACH-06': false,
  },
  unlocks: { 'UNL-01': false, 'UNL-02': false },
  run: null,
  settings: { ...DEFAULT_SETTINGS },
  recovered: false,
});

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

/** schema 验证（必需字段缺失・类型不正 = 损坏 — contract §6。按字段填默认值的静默修复不做） */
const isValidSaveData = (value: unknown): boolean => {
  if (!isRecord(value)) {
    return false;
  }
  // save_version: 缺失・未来版本・过去版本均视同损坏（禁止隐式降级/升级）
  if (value['save_version'] !== SAVE_VERSION) {
    return false;
  }
  if (!isFiniteNumber(value['best_score']) || (value['best_score'] as number) < 0) {
    return false;
  }
  const stats = value['stats'];
  if (
    !isRecord(stats) ||
    !isFiniteNumber(stats['finished_runs']) ||
    !isFiniteNumber(stats['silver_peak']) ||
    !isFiniteNumber(stats['rep_peak']) ||
    !isFiniteNumber(stats['served_total'])
  ) {
    return false;
  }
  const endings = value['endings_seen'];
  if (
    !Array.isArray(endings) ||
    endings.length !== ENDINGS_COUNT ||
    !endings.every(isBoolean)
  ) {
    return false;
  }
  const achievements = value['achievements'];
  if (
    !isRecord(achievements) ||
    !ACHIEVEMENT_IDS.every((id) => isBoolean(achievements[id]))
  ) {
    return false;
  }
  const unlocks = value['unlocks'];
  if (!isRecord(unlocks) || !UNLOCK_IDS.every((id) => isBoolean(unlocks[id]))) {
    return false;
  }
  const run = value['run'];
  if (run !== null && !isRecord(run)) {
    return false;
  }
  if (isRecord(run)) {
    if (!isFiniteNumber(run['day']) || !isFiniteNumber(run['silver']) || !isFiniteNumber(run['reputation'])) {
      return false;
    }
  }
  const settings = value['settings'];
  if (
    !isRecord(settings) ||
    !isVolume(settings['bgm_volume']) ||
    !isVolume(settings['sfx_volume']) ||
    !LANGUAGES.includes(settings['lang'] as LanguageCode)
  ) {
    return false;
  }
  return true;
};

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
    return { data: defaultSaveData(), recovered: true };
  }
  console.error(`[SaveCorruption] reason=${reason} backup=${backupKey}`);
  return { data: defaultSaveData(), recovered: true };
};

/** 存档读取。键不存在 = 首次启动（非损坏 — recovered=false 的默认值） */
export const loadSaveData = (storage: Storage = globalThis.localStorage): SaveLoadResult => {
  let raw: string | null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch (error) {
    console.error(`[SaveCorruption] reason=storage-unreadable detail=${String(error)}`);
    return { data: defaultSaveData(), recovered: true };
  }
  if (raw === null) {
    return { data: defaultSaveData(), recovered: false };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return recoverCorrupted(storage, raw, 'parse-failed');
  }
  if (!isValidSaveData(parsed)) {
    return recoverCorrupted(storage, raw, 'schema-validation-failed');
  }
  return { data: parsed as SaveData, recovered: false };
};

/** 存档写入（设置变更 / run 快照 / applyRunResult 等的唯一直写出口） */
export const saveSaveData = (data: SaveData, storage: Storage = globalThis.localStorage): void => {
  storage.setItem(SAVE_KEY, JSON.stringify(data));
};
