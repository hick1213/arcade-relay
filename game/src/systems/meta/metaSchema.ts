/**
 * metaSchema — 存档的迁移函数链 + schema 验证（S-14。tech-stack.md「存档 / 持久化」）。
 *
 * - 引擎无关层: 禁止 import Phaser、禁止引用 localStorage。只接收已解析的值并返回结果。
 * - 迁移: 依次应用 v(n)→v(n+1) 的函数（只增不改）。比 SAVE_VERSION 更新的版本不做转换、
 *   视同损坏（禁止隐式降级 — contract §6）。
 * - 验证: 必需字段缺失、类型不正 = 损坏（schema-validation-failed）。按字段逐个填入默认值的
 *   静默修复不做（rules/gameplay-code.md 强制）。
 * - 首次启动（无存档键）的初始状态 = createDefaultSaveData()（gdd「存档数据方针」表）。
 */
import { DEFAULT_SETTINGS, META_SAVE, SAVE_VERSION } from '../../config';
import type { AchievementId, SaveData, UnlockId } from './metaTypes';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

/** 音量为 0–1（gdd「存档数据方针」settings） */
const isVolume = (value: unknown): value is number =>
  isFiniteNumber(value) && value >= 0 && value <= 1;

/** 首次启动时的初始状态（gdd「存档数据方针」表 — 初始值的唯一构建处） */
export const createDefaultSaveData = (): SaveData => ({
  save_version: SAVE_VERSION,
  best_score: 0,
  stats: { ...META_SAVE.STATS_INITIAL },
  endings_seen: Array.from({ length: META_SAVE.ENDINGS_COUNT }, () => false),
  achievements: META_SAVE.ACHIEVEMENT_IDS.reduce(
    (acc, id) => ({ ...acc, [id]: false }),
    {} as Record<AchievementId, boolean>,
  ),
  unlocks: META_SAVE.UNLOCK_IDS.reduce(
    (acc, id) => ({ ...acc, [id]: false }),
    {} as Record<UnlockId, boolean>,
  ),
  run: null,
  settings: { ...DEFAULT_SETTINGS },
  recovered: false,
});

/** v1 schema 验证（必需字段・类型・范围。字段名与 metaTypes.SaveDataV1 一致） */
const isValidSaveDataV1 = (value: unknown): boolean => {
  if (!isRecord(value)) {
    return false;
  }
  if (!isFiniteNumber(value['save_version']) || value['save_version'] !== SAVE_VERSION) {
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
    endings.length !== META_SAVE.ENDINGS_COUNT ||
    !endings.every(isBoolean)
  ) {
    return false;
  }
  const achievements = value['achievements'];
  if (
    !isRecord(achievements) ||
    !META_SAVE.ACHIEVEMENT_IDS.every((id) => isBoolean(achievements[id]))
  ) {
    return false;
  }
  const unlocks = value['unlocks'];
  if (!isRecord(unlocks) || !META_SAVE.UNLOCK_IDS.every((id) => isBoolean(unlocks[id]))) {
    return false;
  }
  const run = value['run'];
  if (run !== null && !isRecord(run)) {
    return false;
  }
  if (isRecord(run)) {
    if (
      !isFiniteNumber(run['day']) ||
      !isFiniteNumber(run['silver']) ||
      !isFiniteNumber(run['reputation'])
    ) {
      return false;
    }
  }
  const settings = value['settings'];
  if (
    !isRecord(settings) ||
    !isVolume(settings['bgm_volume']) ||
    !isVolume(settings['sfx_volume']) ||
    !(META_SAVE.LANGUAGE_CODES as readonly unknown[]).includes(settings['lang'])
  ) {
    return false;
  }
  if (!isBoolean(value['recovered'])) {
    return false;
  }
  return true;
};

/** schema 层的损坏原因（persistence 层据此输出 [SaveCorruption] 日志） */
export type SchemaFailureReason =
  | 'missing-version'
  | 'future-version'
  | 'schema-validation-failed';

export type SchemaResult =
  | { readonly ok: true; readonly data: SaveData }
  | { readonly ok: false; readonly reason: SchemaFailureReason };

/** 迁移函数链。MIGRATIONS[v - 1] = v→v+1 的升级函数（v1→v2 追加于 index 0，之后只增不改） */
type Migration = (data: Record<string, unknown>) => Record<string, unknown>;
const MIGRATIONS: readonly Migration[] = [];

/**
 * 已解析 JSON → 版本升级 → v1 schema 验证。
 * 验证不合格时返回 ok: false（损坏判定与 .bak 备份在 persistence 层执行）。
 */
export const migrateSaveData = (parsed: unknown): SchemaResult => {
  if (!isRecord(parsed)) {
    return { ok: false, reason: 'schema-validation-failed' };
  }
  if (!isFiniteNumber(parsed['save_version'])) {
    return { ok: false, reason: 'missing-version' };
  }
  const fromVersion = parsed['save_version'];
  if (fromVersion > SAVE_VERSION) {
    // 比当前版本更新的数据 — 不迁移、视同损坏（禁止隐式降级 — tech-stack.md）
    return { ok: false, reason: 'future-version' };
  }
  let current: Record<string, unknown> = parsed;
  for (let version = fromVersion; version < SAVE_VERSION; version += 1) {
    const migrate = MIGRATIONS[version - 1];
    if (!migrate) {
      // 迁移链缺口（未实现版本）→ 验证不合格＝损坏处理（静默通过禁止）
      return { ok: false, reason: 'schema-validation-failed' };
    }
    current = migrate(current);
  }
  if (!isValidSaveDataV1(current)) {
    return { ok: false, reason: 'schema-validation-failed' };
  }
  return { ok: true, data: current as unknown as SaveData };
};
