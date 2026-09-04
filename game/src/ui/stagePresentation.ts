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
import { headChefCraft } from '../systems/kitchen';
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
/** 铁牛の低位のみ黑烟/高阶のみ金光（gdd 差分表: 铁牛「低位制菜冒黑烟；高阶出菜带金光」—
 *  CR-CODE iter1 finding 1: 残影/ぐらつきと同型の伙计条件ゲートに統一。掌勺が谁であれ
 *  铁牛本人が掌勺のときのみ出る） */
const SMOKE_STAFF_ID = 'tieniu';
const SMOKE_STAGE: Stage = 0;
const GLOW_STAFF_ID = 'tieniu';
const GLOW_STAGE: Stage = 2;

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
 * 当日の掌勺（岗位≠修练で手艺最高の伙计）。CR-CODE iter1 finding 2: 選定ルールの ui 側
 * 再実装をやめ、systems/kitchen.headChefCraft（掌勺手艺 = 非修练中の最高 craft）の値を
 * 直接参照して同値のメンバーを引く — systems 側の短縮ルール変更には自動追従する。
 * （identity getter が systems 側に無いための同値照合 — getter が追加されれば置き換える。
 *  判断事項として gameplay-engineer への getter 追加依頼は報告済み）
 */
export function headChefStaff(run: RunState): StaffMember | null {
  const maxCraft = headChefCraft(run);
  return run.staff.find((member) => member.post !== 'training' && member.craft === maxCraft) ?? null;
}

/** 掌勺の成长阶段（掌勺不在 = null — 黑烟/金光とも出さない） */
function headChefStage(run: RunState): Stage | null {
  const chef = headChefStaff(run);
  return chef === null ? null : growthStage(chef.speed + chef.craft + chef.stamina);
}

/** 黑烟/金光の表示条件（gdd 差分表 — 铁牛本人が掌勺のときのみ。CR-CODE iter1 finding 1） */
export interface HeadChefFx {
  /** 铁牛（掌勺）が低位 → 制菜黑烟 */
  readonly smoke: boolean;
  /** 铁牛（掌勺）が高阶 → 出菜金光 */
  readonly glow: boolean;
}

const HEAD_CHEF_FX_OFF: HeadChefFx = { smoke: false, glow: false };

/** 黑烟/金光の出現判定（表示導出のみ — 值は保存しない。掌勺不在/铁牛以外は両方 off） */
export function headChefFx(run: RunState): HeadChefFx {
  const chef = headChefStaff(run);
  if (chef === null) {
    return HEAD_CHEF_FX_OFF;
  }
  const stage = headChefStage(run);
  return {
    smoke: chef.id === SMOKE_STAFF_ID && stage === SMOKE_STAGE,
    glow: chef.id === GLOW_STAFF_ID && stage === GLOW_STAGE,
  };
}
