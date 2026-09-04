/**
 * metaTypes — 元进度存档的按版本区分的普通类型（S-14。contract §11 / tech-stack.md「存档 / 持久化」）。
 *
 * - 引擎无关层: 禁止 import Phaser、禁止引用 localStorage（I/O 一律经 src/persistence/）。
 * - shape 权威 = 本文件（types.ts 的存档节自本 story 起改为 re-export，禁止第二份定义）。
 * - 版本方针: 每个存档版本一个具名 interface（SaveDataV1…）。字段只增不改；
 *   破坏性变更 = 新版本 + metaSchema 追加迁移函数，禁止改写旧版本类型。
 * - 字段名与 gdd「存档数据方针」表一一对应。
 */

import type { META_SAVE } from '../../config';

// ==== 枚举（id 一览的唯一来源 = config.META_SAVE — 调整只动 config。
// 联合类型由 config 数组编译时派生 → 列表与类型的两源偏差不可能发生
//（漏记/误记 id 即编译错误 — CR-CODE iter1 finding 1）====
export type AchievementId = (typeof META_SAVE.ACHIEVEMENT_IDS)[number];
export type UnlockId = 'UNL-01' | 'UNL-02';
export type LanguageCode = 'zh' | 'en' | 'ja' | 'ko' | 'th';

/** 统计（gdd「统计」表） */
export interface MetaStats {
  readonly finished_runs: number;
  readonly silver_peak: number;
  readonly rep_peak: number;
  readonly served_total: number;
}

/** 设置（音量接线到实际音频输出并持久化 — contract §11 Menu 必需要素） */
export interface MetaSettings {
  readonly bgm_volume: number;
  readonly sfx_volume: number;
  readonly lang: LanguageCode;
}

/**
 * 周目续玩快照。gdd: 保存日数/银子/声望/侠点/伙计表/弃牌堆。
 * Menu 仅判定存在性（run !== null → 显示「继续周目」）; 全字段由 run 快照 story（S-23）扩展
 * （追加字段不破坏本契约）。终战败保留、破产/终战胜时置 null（gdd「存档数据方针」）。
 */
export interface RunSnapshot {
  readonly day: number;
  readonly silver: number;
  readonly reputation: number;
  readonly [key: string]: unknown;
}

/** SaveData v1（save_version = config.SAVE_VERSION。迁移与验证 = metaSchema.ts） */
export interface SaveDataV1 {
  readonly save_version: number;
  /** 最高总评分（applyRunResult 计算的 score 最大值 — gdd「最高分 / 最佳时间」） */
  readonly best_score: number;
  readonly stats: MetaStats;
  /** 3 结局（财/侠/名）达成标志（下标映射 = config.META_SAVE.ENDING_INDEX） */
  readonly endings_seen: readonly boolean[];
  readonly achievements: Readonly<Record<AchievementId, boolean>>;
  readonly unlocks: Readonly<Record<UnlockId, boolean>>;
  readonly run: RunSnapshot | null;
  readonly settings: MetaSettings;
  /** 仅存档损坏恢复会话中为 true（contract §6 — 传播到 Title/Menu 显示通知。持久化快照恒 false） */
  readonly recovered: boolean;
}

/** 当前版本的 SaveData（UI / scenes / systems 统一引用名。升级时随之指向新版本） */
export type SaveData = SaveDataV1;
