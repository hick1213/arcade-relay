/**
 * stagePresentation — 成长阶段（3 档）→ 表示差分の対応づけ（S-28）。
 *
 * - gdd「伙计初始值」差分表（P-02: 成长可视化）の表示側写像のみを担う。
 *   数值・色は config.STAGE_FX / GAMEPLAY の权威に従い、ここでは「谁がどれを使うか」だけを決める。
 * - 纯函数・Phaser 非依赖（表示パラメータを返すだけ — 描画は ui/GameplayView）。systems 层は
 *   gameplay-engineer 職域のため本モジュールは ui/ に置く（tech-stack.md: Phaser 依存は ui/ に封閉）。
 * - 台词は systems/i18n 言語表の key を返すだけ（文案はここに置かない — conventions 规则 4）。
 */
import { GAMEPLAY, STAGE_FX } from '../config';
import { TEXT_KEYS } from '../textKeys';
import { growthStage } from '../systems/training';
import type { RunState, StaffMember } from '../types';

/** 成长阶段（training.growthStage の 3 档） */
type Stage = 0 | 1 | 2;

/** 伙计別台词库（gdd 差分表: 性格ごとの 3 段。unlock 伙计はフォールバック） */
const STAFF_LINE_KEY_TABLE: Readonly<Record<string, readonly [string, string, string]>> = {
  afu: [TEXT_KEYS.STAFF_LINE_AFU_1, TEXT_KEYS.STAFF_LINE_AFU_2, TEXT_KEYS.STAFF_LINE_AFU_3],
  tieniu: [TEXT_KEYS.STAFF_LINE_TIENIU_1, TEXT_KEYS.STAFF_LINE_TIENIU_2, TEXT_KEYS.STAFF_LINE_TIENIU_3],
  wenqu: [TEXT_KEYS.STAFF_LINE_WENQU_1, TEXT_KEYS.STAFF_LINE_WENQU_2, TEXT_KEYS.STAFF_LINE_WENQU_3],
  xiaodie: [TEXT_KEYS.STAFF_LINE_XIAODIE_1, TEXT_KEYS.STAFF_LINE_XIAODIE_2, TEXT_KEYS.STAFF_LINE_XIAODIE_3],
  dasong: [TEXT_KEYS.STAFF_LINE_DASONG_1, TEXT_KEYS.STAFF_LINE_DASONG_2, TEXT_KEYS.STAFF_LINE_DASONG_3],
};

/** 汎用阶段台词（S-07 既有 — STAFF_LINE_KEY_TABLE 未登记 id のフォールバック） */
const GENERIC_LINE_KEYS: readonly [string, string, string] = [
  TEXT_KEYS.STAFF_LINE_STAGE_1,
  TEXT_KEYS.STAFF_LINE_STAGE_2,
  TEXT_KEYS.STAFF_LINE_STAGE_3,
];

/** 台词 key（伙计×阶段。未登记 id → 汎用阶段台词） */
export function staffStageLineKey(staffId: string, stage: Stage): string {
  const lineKeys = STAFF_LINE_KEY_TABLE[staffId] ?? GENERIC_LINE_KEYS;
  return lineKeys[stage] as string;
}

/** plate 蒙层色调（伙计別 ramp。未登记 id → GAMEPLAY.STAGE_TINTS の汎用 ramp） */
export function staffStageTint(staffId: string, stage: Stage): number {
  const ramp = STAGE_FX.TINTS_BY_STAFF[staffId];
  if (ramp === undefined) {
    return GAMEPLAY.STAGE_TINTS[stage] as number;
  }
  return ramp[stage] as number;
}

/** 跑堂の移動演出パラメータ（ bob / ぐらつき / 残影 — 阶段と性格で差をつける） */
export interface StagePresentation {
  /** 移動中の上下弾み振幅（px） */
  readonly bobAmpPx: number;
  /** 弾み周波数（Hz — 阶段が上がるほど速い = 目視できる速度差） */
  readonly bobFreqHz: number;
  /** 移動中の左右ぐらつき（radian。小蝶の低位「同手同脚」のみ > 0） */
  readonly waddleRad: number;
  /** 移動中の残影（阿福の高阶「跑位带残影」） */
  readonly trail: boolean;
  /** plate 蒙层色调 */
  readonly tint: number;
  /** 台词 key */
  readonly lineKey: string;
}

const DEG_TO_RAD = Math.PI / 180;

/** 阿福の高阶のみ残影（gdd 差分表: 阿福「高阶后跑位带残影」） */
const TRAIL_STAFF_ID = 'afu';
const TRAIL_STAGE: Stage = 2;
/** 小蝶の低位のみぐらつき（gdd 差分表: 小蝶「低位走路同手同脚」） */
const WADDLE_STAFF_ID = 'xiaodie';
const WADDLE_STAGE: Stage = 0;

export function staffStagePresentation(staffId: string, stage: Stage): StagePresentation {
  return {
    bobAmpPx: STAGE_FX.BOB_AMP_PX[stage] as number,
    bobFreqHz: STAGE_FX.BOB_FREQ_HZ[stage] as number,
    waddleRad:
      staffId === WADDLE_STAFF_ID && stage === WADDLE_STAGE ? STAGE_FX.WADDLE_DEG * DEG_TO_RAD : 0,
    trail: staffId === TRAIL_STAFF_ID && stage === TRAIL_STAGE,
    tint: staffStageTint(staffId, stage),
    lineKey: staffStageLineKey(staffId, stage),
  };
}

/**
 * 当日の掌勺（岗位≠修练で手艺最高の伙计 — systems/kitchen.headChefCraft と同一规则の
 * 実体 ident 版。表示（黑烟/金光の出现条件）のための導出のみで、UI 側で値を保存しない。
 * 招待側に identity getter が無いための ui 側導出 — kitchen 側に変更が入った場合は
 * gameplay-engineer へ getter 追加を依頼すること（判断事項として報告済み）。
 */
export function headChefStaff(run: RunState): StaffMember | null {
  let chef: StaffMember | null = null;
  for (const member of run.staff) {
    if (member.post === 'training') {
      continue;
    }
    if (chef === null || member.craft > chef.craft) {
      chef = member;
    }
  }
  return chef;
}

/** 掌勺の成长阶段（掌勺不在 = null — 黑烟/金光とも出さない） */
export function headChefStage(run: RunState): Stage | null {
  const chef = headChefStaff(run);
  return chef === null ? null : growthStage(chef.speed + chef.craft + chef.stamina);
}
