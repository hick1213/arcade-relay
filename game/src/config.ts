/**
 * 全部游戏参数的权威来源（tech-stack.md 规范 1: 禁止魔法数字）。
 * GDD「数值表」的常量在实现各系统的 story 中按 GDD 记载初始值逐次追加于此。
 * 本文件当前为脚手架阶段的最小集合。
 */
import type { HudState, PostId, RunEndSummary, StaffSeed } from './types';

// ==== 画面 ====
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

// ==== 持久化 ====
export const SAVE_KEY = 'arcaderelay-save';
export const SAVE_BACKUP_PREFIX = 'arcaderelay-save.bak.';
/** SaveData 版本（gdd「存档数据方针」。比此更新的版本视同损坏 — 禁止隐式降级） */
export const SAVE_VERSION = 1;
/** 首次启动时的设置初始值（gdd「存档数据方针」表） */
export const DEFAULT_SETTINGS = { bgm_volume: 0.7, sfx_volume: 0.8, lang: 'zh' } as const;

// ==== 元进度 schema（S-14 — gdd「元进度（游戏外）」「存档数据方针」。ID 一览与初始值的唯一来源。
// metaTypes/metaSchema/metaProgression 按此构建/验证 — 调整阈值或增删条目只动这里）====
export const META_SAVE = {
  /** 结局图鉴格数（财/侠/名 — gdd「统计」endings_seen[3]） */
  ENDINGS_COUNT: 3,
  /** 结局 id → endings_seen 下标（S-20 结局判定接线时使用同一映射） */
  ENDING_INDEX: { wealth: 0, xia: 1, fame: 2 } as const,
  /** 成就 id（gdd「成就」表。判定接线 = S-21） */
  ACHIEVEMENT_IDS: ['ACH-01', 'ACH-02', 'ACH-03', 'ACH-04', 'ACH-05', 'ACH-06'],
  /** 解锁 id（gdd「解锁」表。解放接线 = S-22） */
  UNLOCK_IDS: ['UNL-01', 'UNL-02'],
  /** 界面语言（gdd「设置」— i18n 全量 = S-24） */
  LANGUAGE_CODES: ['zh', 'en', 'ja', 'ko', 'th'],
  /** 统计初始值（gdd「存档数据方针」stats — 全 0） */
  STATS_INITIAL: { finished_runs: 0, silver_peak: 0, rep_peak: 0, served_total: 0 },
} as const;

// ==== 资产引用（tech-stack.md 规范 5: ASSET_KEYS）====
// design/assets.md 的 IMG-xx / SFX-xx / BGM-xx 资产到位后在此登记。
// 键名 = 资产用途（conventions「命名」: 不使用 IMG-xx 编号），值 = assets/ 下相对路径（不含扩展名）。

// 音频交付格式（design/assets.md「音频」节: OGG Vorbis + M4A/AAC 双格式。BootScene 据此展开 URL、
// Phaser AudioFile 以浏览器 canPlay 自动择一 — Safari 落 M4A、其余落 OGG）
export const AUDIO_FORMATS = ['ogg', 'm4a'] as const;

// SFX-01～08（已生成 — game/assets/MANIFEST.jsonl。变调复用变体由 S-27 以 detune/rate 实现、不新增文件）
export const ASSET_KEYS = {
  audio: {
    sfxUiTap: 'assets/audio/sfx-ui-tap', // SFX-01（菜单确认/通用 UI tap）
    sfxDoorOpen: 'assets/audio/sfx-door-open', // SFX-02
    sfxOrderBubble: 'assets/audio/sfx-order-bubble', // SFX-03
    sfxDishServe: 'assets/audio/sfx-dish-serve', // SFX-04
    sfxCoinCollect: 'assets/audio/sfx-coin-collect', // SFX-05
    sfxFailLeave: 'assets/audio/sfx-fail-leave', // SFX-06
    sfxAbacusLedger: 'assets/audio/sfx-abacus-ledger', // SFX-07
    sfxBattleGong: 'assets/audio/sfx-battle-gong', // SFX-08
  },

  // 背景/精灵（S-33: IMG-01～30 正式资产 — design/assets.md。値 = assets/ 下のパス = そのまま
  // Phaser のテクスチャキー（audio と同一規約）。表示サイズは SPRITE_DISPLAY、
  // 実体との対応づけは systems/visualAssets.ts に集約）
  images: {
    // IMG-01～03 奥底背景（晨/日/夜 — 相位切换。opaque、cover 裁切至 1280x720）
    bgInnMorning: 'assets/images/tile-inn-hall-morning.png',
    bgInnDay: 'assets/images/tile-inn-hall-day.png',
    bgInnNight: 'assets/images/tile-inn-hall-night.png',
    // IMG-04～10 伙计立绘（キー = STAFF_ROSTER.id に対応。IMG-09/10 = UNL-01/02 解锁伙计）
    staffAfu: 'assets/images/sprite-staff-a-fu.png',
    staffTieniu: 'assets/images/sprite-staff-tie-niu.png',
    staffWenqu: 'assets/images/sprite-staff-wen-qu.png',
    staffXiaodie: 'assets/images/sprite-staff-xiao-die.png',
    staffDasong: 'assets/images/sprite-staff-da-song.png',
    staffLiubiaotou: 'assets/images/sprite-staff-liu-biao-tou.png',
    staffSuyuchu: 'assets/images/sprite-staff-su-yu-chu.png',
    // IMG-11～13 客人（散客/镖师/老饕 — customer.id で循环割当）
    guestCommoner: 'assets/images/sprite-guest-commoner.png',
    guestEscort: 'assets/images/sprite-guest-escort.png',
    guestGourmet: 'assets/images/sprite-guest-gourmet.png',
    // IMG-14 大敌（终战 — finalBattleNight の夜に表示）
    rivalWarlord: 'assets/images/sprite-rival-warlord.png',
    // IMG-15～20 菜品图标（菜号 1～6 = 配列順。systems/visualAssets.ts の dishSpriteKey）
    dish1: 'assets/images/sprite-dish-01-noodles.png',
    dish2: 'assets/images/sprite-dish-02-buns.png',
    dish3: 'assets/images/sprite-dish-03-chicken.png',
    dish4: 'assets/images/sprite-dish-04-tofu.png',
    dish5: 'assets/images/sprite-dish-05-fish.png',
    dish6: 'assets/images/sprite-dish-06-broth.png',
    // IMG-21 圆桌（6 桌に程序化摆放）
    tableRound: 'assets/images/sprite-table-round.png',
    // IMG-22～24 志向图标（財/侠/名）
    ambitionWealth: 'assets/images/ui-ambition-wealth.png',
    ambitionXia: 'assets/images/ui-ambition-xia.png',
    ambitionRenown: 'assets/images/ui-ambition-renown.png',
    // IMG-25 事件卡框（夜间卡段の背飾り）
    eventCardFrame: 'assets/images/ui-event-card-frame.png',
    // IMG-26～28 结局插画（財/侠/名 — ResultScene 侧の接线は ui-engineer lane）
    endingWealth: 'assets/images/tile-ending-wealth.png',
    endingXia: 'assets/images/tile-ending-xia.png',
    endingRenown: 'assets/images/tile-ending-renown.png',
    // IMG-29 标题 emblem（無文字装飾 — タイトル文は Phaser Text で中央に重ねる）
    titleEmblem: 'assets/images/ui-title-emblem.png',
  },

  // IMG-30 共通 UI sheet（assets.md「IMG-30 的切分」: 不可視規則グリッド = IMG_SHEET_FRAME の
  // 3x2 = 512px 帧。フレーム参照は ui/ 側の置換対象 — placeholderTextures の注記どおり）
  spriteSheets: {
    commonSheet: 'assets/images/ui-common-sheet.png',
  },

  // BGM-01/02 未生成（design/assets.md「生成实绩」: 留到 Phase 3。到位后在此登记）
  // UI 占位纹理（S-10 ui-engineer。运行时程序化生成 — game/src/ui/placeholderTextures.ts。
  // IMG-xx UI 资产到位后替换为正式资产键即可，显示组件无需改动）
  uiPlaceholder: {
    hudChip: 'ui/hud-chip',
    ledgerButton: 'ui/ledger-button',
    pausePanel: 'ui/pause-panel',
    pauseButton: 'ui/pause-button',
    menuButton: 'ui/menu-button', // S-13 Menu 纵向按钮列（MENU.BUTTON_WIDTH x HEIGHT）
    menuPanel: 'ui/menu-panel', // S-13 图鉴统计/设置模态面板（MENU.PANEL_WIDTH x HEIGHT）
    resultPanel: 'ui/result-panel', // S-15 Result 总评分面板（RESULT.PANEL_WIDTH x HEIGHT）
    titleEmblem: 'ui/title-emblem', // S-12 Title emblem 占位（TITLE.EMBLEM_SIZE 正方形）
  },
} as const;

// ==== 输入（P-04 纯点击 — S-01。出处: gdd「数值表」「输入」节）====
/** 最小可点击判定区边长（px）。gdd 数值表: 初始 48、调整范围 48–64 */
export const BUTTON_MIN_SIZE_PX = 48;
/** 点击命中优先级。gdd「输入」节: 暂停面板 > 事件卡选项 > 出餐口 > 收钱气泡 > 点单桌 */
export const INPUT_PRIORITY = {
  PAUSE_PANEL: 50,
  EVENT_CARD_OPTION: 40,
  SERVE_WINDOW: 30,
  PAYMENT_BUBBLE: 20,
  TABLE_ORDER: 10,
} as const;

// ==== UI（S-10: HUD 与帐本暂停面板 — ui-engineer。颜色全部取自 design/art-bible.json 调色板）====
export const UI = {
  // 深度（游玩对象默认 0 之上。UI 不覆盖游玩区域中央）
  DEPTH_HUD: 100,
  DEPTH_PAUSE: 200,

  // HUD 布局（画面上缘一排。数值仅从本基准分辨率推导 — Scale.FIT 下不错位）
  HUD_MARGIN: 16,
  HUD_BAR_HEIGHT: 56,
  HUD_CHIP_WIDTH: 172,
  HUD_CHIP_HEIGHT: 44,
  HUD_CHIP_GAP: 12,
  HUD_CHIP_PADDING: 12,

  // HUD 文字（ui-code 规范: 一眼可读的尺寸＋墨色描边与背景分离）
  HUD_FONT_FAMILY: 'sans-serif',
  // 文本渲染 resolution（S-32: UI 模糊修复。Phaser Text 默认以 1x 光栅化，Scale.FIT 缩放/
  // 高 DPI 显示下笔画发糊 — 内部 canvas 以 2x 光栅化后回缩，字形边缘显著锐化。
  // 覆盖 0.5x/2x 窗口尺寸的 acceptance。全部 Text 一律经由本常量，禁止散置魔法数字）
  TEXT_RESOLUTION: 2,
  HUD_LABEL_FONT_SIZE: '15px',
  HUD_VALUE_FONT_SIZE: '22px',
  HUD_TEXT_COLOR: '#F0C182',
  HUD_VALUE_COLOR: '#F0C182',
  HUD_STROKE_COLOR: '#281D10',
  HUD_STROKE_WIDTH: 3,

  // 「帐本」按钮（右上。≥ BUTTON_MIN_SIZE_PX — gdd「输入」节）
  HUD_LEDGER_WIDTH: 64,
  HUD_LEDGER_HEIGHT: 48,
  HUD_LEDGER_FONT_SIZE: '18px',

  // 数值变化的即时反馈（增=金 / 减=朱，调色板 accent 色）
  HUD_FLASH_UP_COLOR: '#C18E52',
  HUD_FLASH_DOWN_COLOR: '#963A16',
  HUD_FLASH_SCALE: 1.18,
  HUD_FLASH_MS: 360,
  HUD_POPUP_OFFSET_Y: 8,
  HUD_POPUP_RISE_PX: 30,
  HUD_POPUP_MS: 720,
  HUD_POPUP_FONT_SIZE: '20px',

  // 暂停面板（画面中央模态。3 按钮: 继续 / 结束周目（S-03/S-08 接线前的临时経路）/ 回到菜单）
  PAUSE_PANEL_WIDTH: 420,
  PAUSE_PANEL_HEIGHT: 380,
  PAUSE_TITLE_OFFSET_Y: 44,
  PAUSE_TITLE_FONT_SIZE: '26px',
  PAUSE_BUTTON_WIDTH: 240,
  PAUSE_BUTTON_HEIGHT: 56,
  PAUSE_BUTTON_STACK_GAP: 72,
  PAUSE_BUTTON_FONT_SIZE: '20px',

  // 按压反馈（纯点击的单次 pointerdown）
  BUTTON_PRESS_SCALE: 0.94,
  BUTTON_PRESS_MS: 120,

  // 占位面板配色（fill=深棕 / stroke=墨褐 / accent=金 — art-bible 调色板）
  PANEL_FILL: 0x653917,
  PANEL_FILL_ALPHA: 0.94,
  PANEL_STROKE: 0x281d10,
  PANEL_STROKE_WIDTH: 4,
  PANEL_RADIUS: 10,
  PANEL_ACCENT: 0xc18e52,
  PANEL_ACCENT_WIDTH: 2,
  PANEL_ACCENT_INSET: 6,
  PANEL_BRIGHT_ACCENT: 0xf0c182,

  // 暂停中的画面变暗遮罩（视觉上传达「已暂停」）
  BLOCKER_COLOR: 0x281d10,
  BLOCKER_ALPHA: 0.55,

  // 输入路由的模态层与判定区 id（S-01 InputRouter。暂停面板 > 其余全部 — conventions 规则 7）
  PAUSE_LAYER_ID: 'pause',
  ZONE_LEDGER: 'ui.ledger',
  ZONE_PAUSE_RESUME: 'ui.pause.resume',
  ZONE_PAUSE_END_RUN: 'ui.pause.endRun',
  ZONE_PAUSE_MENU: 'ui.pause.menu',
} as const;

// ==== 评分（S-15 ResultScene 总评分。出处: story S-15 acceptance 的公式）====
// 注意: design/gdd.md「总评分」公式行记 silverEnd×0.5，同节「三线贡献表」记权重 2 — 两者矛盾。
// 本处暂以 acceptance 公式（0.5）为准；调参只改此处，判断事项已上报 game-designer。
export const SCORE = {
  WEIGHT_SILVER: 0.5,
  WEIGHT_REPUTATION: 10,
  WEIGHT_POWER: 20,
} as const;

// ==== Result 场景（S-15: ResultScene 与场景循环闭合 — ui-engineer。布局由 GAME_WIDTH/HEIGHT
// 基准分辨率推导，Scale.FIT 下不错位。配色复用 art-bible 调色板的 UI.PANEL_* / HUD_* 常量）====
export const RESULT = {
  // 模态面板（画面中央）
  PANEL_WIDTH: 560,
  PANEL_HEIGHT: 460,

  // 标题（败局 / 周目结果）
  TITLE_OFFSET_Y: -158,
  TITLE_FONT_SIZE: '34px',

  // 总评分（大字号 — 一眼可读的单一数字化）
  SCORE_LABEL_OFFSET_Y: -96,
  SCORE_LABEL_FONT_SIZE: '20px',
  SCORE_VALUE_OFFSET_Y: -58,
  SCORE_VALUE_FONT_SIZE: '44px',

  // 评分明细（4 行: 银子 / 声望 / 伙计实力 / 结局加成）
  BREAKDOWN_START_OFFSET_Y: 4,
  BREAKDOWN_LINE_GAP: 34,
  BREAKDOWN_FONT_SIZE: '18px',
  BREAKDOWN_LABEL_X_OFFSET: -180,
  BREAKDOWN_VALUE_X_OFFSET: 180,

  // 按钮（画面中央下部横排 2 个）
  BUTTON_WIDTH: 240,
  BUTTON_HEIGHT: 56,
  BUTTON_GAP: 32,
  BUTTONS_OFFSET_Y: 170,
  BUTTON_FONT_SIZE: '20px',
  PRIORITY_BUTTON: 10,

  // 判定区 id
  ZONE_RETRY: 'result.retry',
  ZONE_TO_MENU: 'result.toMenu',

  /** Systems 层接线（S-05/S-08/S-20）前的占位值 — UI 不生成周目数值，仅透传 HUD feed */
  STAFF_POWER_PLACEHOLDER: 0,
  ENDING_BONUS_PLACEHOLDER: 0,
} as const;

/** Result 载荷缺省时的回落值（Systems 层真值接线前的占位 — 与 HUD_INITIAL_STATE 同型的接线占位） */
export const RESULT_FALLBACK_SUMMARY: RunEndSummary = {
  kind: 'runComplete',
  silver: 0,
  reputation: 0,
  staffPower: RESULT.STAFF_POWER_PLACEHOLDER,
  endingBonus: RESULT.ENDING_BONUS_PLACEHOLDER,
};

// ==== Title 场景（S-12: 标题画面显示要素 — ui-engineer。布局由 GAME_WIDTH/HEIGHT 基准分辨率推导，
// Scale.FIT 下不错位。配色复用 art-bible 调色板的 UI.PANEL_* / HUD_* 常量）====
export const TITLE = {
  // emblem 占位（程序化纹理。IMG-xx 正式资产到位后仅替换 ASSET_KEYS）
  EMBLEM_SIZE: 160,
  EMBLEM_Y: 208,

  // 游戏标题文（design/concept.md「一句话概念」: 江湖客满）
  TITLE_TEXT_Y: 356,
  TITLE_FONT_SIZE: '56px',

  // 「点击开始」提示（脉动闪烁 — delta-time 驱动）
  PROMPT_Y: 484,
  PROMPT_FONT_SIZE: '26px',
  PROMPT_PULSE_MS: 900,
  PROMPT_ALPHA_MIN: 0.5,

  // 存档损坏恢复通知（画面上端 1 行 — contract §6 recovered 传播到 Title）
  RECOVERED_NOTICE_Y: 28,
  RECOVERED_NOTICE_FONT_SIZE: '15px',
} as const;

// ==== Menu 场景（S-13: Menu 必需要素 — ui-engineer。布局/字号由 GAME_WIDTH/HEIGHT 基准分辨率推导，
// Scale.FIT 下不错位。配色复用 art-bible 调色板的 UI.PANEL_* / HUD_* 常量）====
export const MENU = {
  // 标题
  TITLE_X_OFFSET_FROM_CENTER: 0,
  TITLE_Y: 104,
  TITLE_FONT_SIZE: '40px',

  // 纵向按钮列（画面中央。继续周目有无导致 4/5 段变化 — 以固定起点向下堆叠）
  BUTTON_WIDTH: 320,
  BUTTON_HEIGHT: 64,
  BUTTON_FONT_SIZE: '24px',
  BUTTON_START_Y: 208,
  BUTTON_GAP: 76,

  // 存档损坏恢复通知（画面上端 1 行 — contract §6 recovered 传播到 Menu）
  RECOVERED_NOTICE_Y: 28,
  RECOVERED_NOTICE_FONT_SIZE: '15px',

  // 模态面板（图鉴统计/设置共通。画面中央）
  PANEL_WIDTH: 620,
  PANEL_HEIGHT: 440,
  PANEL_TITLE_OFFSET_Y: 48,
  PANEL_TITLE_FONT_SIZE: '26px',
  PANEL_LINE_FONT_SIZE: '19px',
  PANEL_LINE_START_Y: 252,
  PANEL_LINE_GAP: 40,
  PANEL_LINE_LABEL_X_OFFSET: -140,
  PANEL_LINE_VALUE_X_OFFSET: 140,
  PANEL_CLOSE_BUTTON_WIDTH: 200,
  PANEL_CLOSE_BUTTON_HEIGHT: 56,
  PANEL_CLOSE_BUTTON_Y: 532,
  PANEL_CLOSE_BUTTON_FONT_SIZE: '20px',

  // 设置面板内操作说明（自动换行）
  PANEL_HINT_TITLE_Y: 392,
  PANEL_HINT_TITLE_FONT_SIZE: '18px',
  PANEL_HINT_BODY_Y: 424,
  PANEL_HINT_BODY_FONT_SIZE: '15px',
  PANEL_HINT_WRAP_WIDTH: 540,

  // 音量滑块（点击轨道任意位置即设定 — P-04 单击、无拖拽依赖）
  SLIDER_TRACK_WIDTH: 340,
  SLIDER_TRACK_HEIGHT: 14,
  SLIDER_HANDLE_WIDTH: 26,
  SLIDER_HANDLE_HEIGHT: 34,
  SLIDER_LABEL_X_OFFSET: -230,
  SLIDER_TRACK_X_OFFSET: 10,
  SLIDER_VALUE_X_OFFSET: 230,
  SLIDER_FONT_SIZE: '18px',
  SETTINGS_BGM_Y: 268,
  SETTINGS_SFX_Y: 332,

  // 语言切换按钮（S-11: zh/en 即时切换。设置面板内、滑块与操作说明の間）
  LANGUAGE_BUTTON_Y: 362,
  LANGUAGE_BUTTON_WIDTH: 260,
  LANGUAGE_BUTTON_HEIGHT: 44,
  LANGUAGE_BUTTON_FONT_SIZE: '18px',

  // 输入路由（模态层屏蔽基础按钮 — conventions 规则 7。模态 > 基础按钮 > 无）
  LAYER_ID: 'menu.modal',
  PRIORITY_BUTTON: 10,
  PRIORITY_MODAL: 60,
  DEPTH_MODAL: 300,

  // 判定区 id
  ZONE_CONTINUE: 'menu.continue',
  ZONE_NEW_RUN: 'menu.newRun',
  ZONE_OPEN_STATS: 'menu.openStats',
  ZONE_OPEN_SETTINGS: 'menu.openSettings',
  ZONE_BACK_TITLE: 'menu.backTitle',
  ZONE_STATS_CLOSE: 'menu.stats.close',
  ZONE_SETTINGS_CLOSE: 'menu.settings.close',
  ZONE_BGM_SLIDER: 'menu.slider.bgm',
  ZONE_SFX_SLIDER: 'menu.slider.sfx',
  ZONE_LANGUAGE_TOGGLE: 'menu.language.toggle',
} as const;

/** HUD 初期表示値（志向确定前的占位。S-04/S-08 接线后由 Systems 层真值置换） */
export const HUD_INITIAL_STATE: HudState = { silver: 0, reputation: 0, day: 1 };

// ==== 共通ユーティリティ ====
/** delta(ms) と gdd の秒定義の换算係数（gdd 数值表は全て秒 — 実装は delta 累计） */
export const MS_PER_SECOND = 1000;

// ==== 一日相位（S-03 dayCycle。出处: gdd「数值表」）====
export const DAY_CYCLE = {
  /** 日间实时段时长（全游戏唯一硬计时） */
  DAY_SERVICE_DURATION_S: 180,
  /** 晨间引导目标（非强制计时。超时仅「开门营业」按钮脉冲） */
  MORNING_GUIDE_TARGET_S: 120,
  /** 终战触发日（该日夜: gdd「胜负条件」） */
  FINAL_BATTLE_DAY: 20,
} as const;

// ==== 志向（S-04 志向选择接线前は DEFAULT_ID で开局。出处: gdd「数值表」SILVER_START/REP_START/
// AMBITION_BIAS。志向选择 UI と 3 志向の开局分岐は story S-04 で接线 — 判断事項）====
export const AMBITION = {
  DEFAULT_ID: 'wealth',
  /** 志向对事件正の効果の偏移率 */
  BIAS: 0.3,
  /** 初始银子/声望（財/侠/名） */
  START: {
    wealth: { silver: 150, reputation: 15 },
    xia: { silver: 60, reputation: 30 },
    fame: { silver: 90, reputation: 40 },
  },
} as const;

// ==== 伙计（gdd「数值表」末尾の「伙计初始值」5 名表をそのまま転写）====
// trainStat（修练で伸びる指定属性）は gdd が属性指定方法を規定しないため、各伙计の
// 得意属性（性格与可见差分欄の对应: 阿福=速/铁牛=艺/文曲=艺/小蝶=体/大嵩=体）を採用 — 判断事項。
export const STAFF_ROSTER: readonly StaffSeed[] = [
  { id: 'afu', nameKey: 'staff.afu', speed: 3, craft: 1, stamina: 2, trainStat: 'speed' },
  { id: 'tieniu', nameKey: 'staff.tieniu', speed: 1, craft: 3, stamina: 2, trainStat: 'craft' },
  { id: 'wenqu', nameKey: 'staff.wenqu', speed: 2, craft: 2, stamina: 1, trainStat: 'craft' },
  { id: 'xiaodie', nameKey: 'staff.xiaodie', speed: 2, craft: 1, stamina: 3, trainStat: 'stamina' },
  { id: 'dasong', nameKey: 'staff.dasong', speed: 1, craft: 1, stamina: 4, trainStat: 'stamina' },
];

export const STAFF = {
  /** 跑堂移动速度基准（px/s。横穿大厅约 3 秒） */
  MOVE_SPEED_PX_PER_S: 220,
  /** 每 1 点速度的动作耗时缩短率（速度 5 点≈肉眼可感の短缩 — P-02） */
  SPEED_FACTOR: 0.15,
  /** 动作耗时缩短率の下限（速度上限.StatMax=10 で 1−0.15×10<0 となる负值ガード — 実装側の安全夹） */
  ACTION_FACTOR_MIN: 0.2,
  /** 每次修练属性增量 */
  TRAINING_GAIN: 1,
  /** 单属性上限 */
  STAT_MAX: 10,
  /** 每日修练位 */
  TRAINING_SLOTS: 2,
  /** 疲劳状态的次日动作耗时倍率（体力 0 时） */
  FATIGUE_PENALTY: 1.2,
  /** 每 1 点体力的疲劳增幅减免率 */
  STAMINA_RESIST: 0.05,
} as const;

/** 岗位容量（gdd「岗位分配系统」: 掌柜 ≤1、采购 0–2、修练 ≤TRAINING_SLOTS、跑堂 0–全员） */
export const POST_CAPACITY: Readonly<Record<PostId, number>> = {
  waiter: STAFF_ROSTER.length,
  manager: 1,
  purchaser: 2,
  training: STAFF.TRAINING_SLOTS,
};

// ==== 日间接客（S-06 customerFlow。出处: gdd「数值表」「难度曲线」「敌人与障碍物」）====
export const CUSTOMER = {
  /** 桌位数（S-02 画面布局: 6 桌固定） */
  SEATS: 6,
  INTERVAL_D1_3_S: 12,
  INTERVAL_D4_9_S: 10,
  INTERVAL_D10_15_S: 8,
  INTERVAL_D16_20_S: 7,
  PATIENCE_D1_3_S: 50,
  PATIENCE_D4_9_S: 45,
  PATIENCE_D10_15_S: 40,
  PATIENCE_D16_20_S: 35,
  /** 无采购时的耐心惩罚（障碍性机制） */
  NO_PURCHASE_PATIENCE_PENALTY_S: 10,
  /** 小费率上限（上菜越快小费越高） */
  TIP_FACTOR: 0.2,
  /** 服务成功的声望（散客 +1。老饕 +2 は build S-16） */
  SERVE_SUCCESS_REPUTATION: 1,
  /** 耐心归零离店的声望惩罚（散客 −2。镖师 −3/老饕 −4 は build S-16） */
  LEAVE_REPUTATION_PENALTY: 2,
  /** 吃完→银两气泡までの時間。gdd 数值表に未定義 — 実装側初始值（調整は本定数のみ） */
  EAT_S: 6,
} as const;

// ==== 点单/上菜/收钱动作（S-06/S-07。出处: gdd「数值表」ORDER_TAKE_S/SERVE_S/STAFF_SPEED_FACTOR）====
export const SERVICE = {
  /** 点单动作耗时 */
  ORDER_TAKE_S: 3,
  /** 上菜动作耗时 */
  SERVE_S: 2,
  /** 收钱动作耗时。gdd 数值表に未定義（収钱は动作耗时×(1−SPEED_FACTOR×速度) の対象に含まれる）—
   *  実装側初始值（SERVE_S 同等。調整は本定数のみ） */
  COLLECT_S: 2,
} as const;

// ==== 后厨（S-06 kitchen。出处: gdd「数值表」DISH_*/PURCHASE_KINDS_*/TEACHING_DISH_CAP/
// CRAFT_KITCHEN_*）====
export const KITCHEN = {
  /** 菜号 1–6（菜价 = MIN + (n−1)×(MAX−MIN)/5 = 菜号そのもの） */
  DISH_COUNT: 6,
  DISH_PRICE_MIN: 1,
  DISH_PRICE_MAX: 6,
  /** 1 号菜制菜耗时。DISH_PREP(n) = BASE + (n−1)×STEP */
  PREP_BASE_S: 6,
  PREP_STEP_S: 1.6,
  /** 每 1 点手艺的制菜耗时缩短率と上限（掌勺手艺 = 当日店内伙计中手艺最高者） */
  CRAFT_FACTOR: 0.1,
  CRAFT_CAP: 0.6,
  /** 采购岗位 0/1/2 人时的当日可选菜种数（菜号 1 起） */
  PURCHASE_KINDS: [2, 4, 6],
  /** 第 1–3 日教学期的可选菜种上限（实际 = min(PURCHASE_KINDS_x, TEACHING_DISH_CAP)） */
  TEACHING_DISH_CAP: 3,
  TEACHING_LAST_DAY: 3,
} as const;

// ==== 经济（S-08 economy。出处: gdd「数值表」DAILY_WAGE_PER_STAFF）====
export const ECONOMY = {
  /** 每名在编伙计的每日工钱（夜间结算扣除。5 名 = 30 两/日） */
  DAILY_WAGE_PER_STAFF: 6,
  /** 在编伙计定员（工钱算式の固定项） */
  ON_ROSTER_STAFF_COUNT: 5,
} as const;

// ==== 事件卡（S-09 eventCard。出处: gdd「数值表」XIA_POINT_PER_CHOICE）====
export const EVENT = {
  /** 侠系事件选项的侠点（卡数据表の侠 Δ は本定数を参照 — 値の一元化） */
  XIA_POINT_PER_CHOICE: 3,
} as const;

// ==== i18n（S-11 systems/i18n。缺 key 回落中文 — DEFAULT_LANGUAGE はその回落先も兼ねる）====
export const I18N = {
  DEFAULT_LANGUAGE: 'zh',
} as const;

// ==== 志向选择レイアウト（S-04。財/侠/名 3 按钮 ≥48px — acceptance の触控下限）====
export const AMBITION_UI = {
  BUTTONS: [
    { x: 340, y: 380 },
    { x: 640, y: 380 },
    { x: 940, y: 380 },
  ],
  BUTTON_WIDTH: 240,
  BUTTON_HEIGHT: 96,
  LABEL_FONT_SIZE: '22px',
  VALUE_FONT_SIZE: '16px',
  TITLE_Y: 180,
  TITLE_FONT_SIZE: '28px',
  HINT_Y: 250,
  HINT_FONT_SIZE: '18px',
} as const;

// ==== 画面布局（S-02: 6 桌/出餐口/柜台の固定构图。GAME_WIDTH×GAME_HEIGHT 基准 —
// Scale.FIT 下任意窗口尺寸不裁切。全部の座標・寸法はここで一元管理）====
export const GAME_LAYOUT = {
  /** 柜台（跑堂の待机位置） */
  COUNTER: { x: 640, y: 648 },
  /** 出餐口 */
  SERVE_WINDOW: { x: 1136, y: 300 },
  /** 6 桌（2 行 ×3 列） */
  TABLES: [
    { x: 250, y: 320 },
    { x: 530, y: 320 },
    { x: 810, y: 320 },
    { x: 250, y: 500 },
    { x: 530, y: 500 },
    { x: 810, y: 500 },
  ],
  TABLE_WIDTH: 120,
  TABLE_HEIGHT: 84,
} as const;

// ==== 晨间排班レイアウト（S-05。岗位图标 4 ＋ 伙计头像 5 ＋「开门营业」）====
export const MORNING = {
  POSTS: [
    { x: 190, y: 300 },
    { x: 450, y: 300 },
    { x: 710, y: 300 },
    { x: 970, y: 300 },
  ],
  POST_WIDTH: 200,
  POST_HEIGHT: 76,
  AVATARS: [
    { x: 160, y: 520 },
    { x: 400, y: 520 },
    { x: 640, y: 520 },
    { x: 880, y: 520 },
    { x: 1120, y: 520 },
  ],
  AVATAR_WIDTH: 96,
  AVATAR_HEIGHT: 96,
  OPEN_DOOR_BUTTON: { x: 640, y: 660 },
  BUTTON_WIDTH: 320,
  BUTTON_HEIGHT: 64,
  HINT_Y: 160,
  HINT_FONT_SIZE: '18px',
  TITLE_Y: 120,
  TITLE_FONT_SIZE: '24px',
  POST_FONT_SIZE: '17px',
  CAPACITY_FONT_SIZE: '14px',
  AVATAR_NAME_FONT_SIZE: '15px',
  AVATAR_POST_FONT_SIZE: '13px',
  AVATAR_STAT_FONT_SIZE: '12px',
  /** 成长阶段別の台词（S-07。头像下 1 行 — 文案は systems/i18n 言語表） */
  AVATAR_LINE_OFFSET_Y: 42,
  AVATAR_LINE_FONT_SIZE: '11px',
} as const;

// ==== 夜间结算/事件卡レイアウト（S-09。结算摘要 → 翻卡 → 选项 → 结果反馈 → 天明）====
export const NIGHT = {
  PANEL_X: 640,
  PANEL_Y: 360,
  PANEL_WIDTH: 660,
  PANEL_HEIGHT: 500,
  TITLE_OFFSET_Y: -200,
  TITLE_FONT_SIZE: '26px',
  SUMMARY_LINE_START_OFFSET_Y: -130,
  SUMMARY_LINE_GAP: 42,
  SUMMARY_FONT_SIZE: '19px',
  /** 摘要行と翻卡ボタンの间隔 */
  DRAW_BUTTON_OFFSET_Y: 200,
  OPTION_WIDTH: 520,
  OPTION_HEIGHT: 60,
  OPTION_START_OFFSET_Y: -110,
  OPTION_GAP: 74,
  OPTION_FONT_SIZE: '17px',
  DAYBREAK_BUTTON_OFFSET_Y: 210,
  RESULT_TEXT_OFFSET_Y: 60,
  RESULT_FONT_SIZE: '17px',
  RESULT_WRAP_WIDTH: 540,
  CARD_TITLE_OFFSET_Y: -170,
  FINAL_NOTICE_OFFSET_Y: 150,
  NOTICE_FONT_SIZE: '18px',
} as const;

// ==== 玩法视图配色（art-bible 调色板の程序化运用 — 新規资产なし。conventions 规则 6）====
export const GAMEPLAY = {
  BG_MORNING: 0x6b4a2a,
  BG_DAY: 0x8a6538,
  BG_NIGHT: 0x2a2138,
  TABLE_FILL: 0x8a5a2e,
  TABLE_STROKE: 0x281d10,
  CUSTOMER_FILL: 0xc18e52,
  STAFF_FILL: 0x963a16,
  SERVE_FILL: 0x653917,
  BUBBLE_FILL: 0xf0e6c8,
  BUBBLE_TEXT_COLOR: '#281d10',
  BUBBLE_WIDTH: 72,
  BUBBLE_HEIGHT: 32,
  PATIENCE_BAR_WIDTH: 72,
  PATIENCE_BAR_HEIGHT: 6,
  PATIENCE_FILL: 0xc18e52,
  PATIENCE_BG: 0x281d10,
  PROGRESS_WIDTH: 480,
  PROGRESS_HEIGHT: 10,
  PROGRESS_FILL: 0xc18e52,
  PROGRESS_BG: 0x281d10,
  PROGRESS_Y: 92,
  MARKER_SIZE: 30,
  /** 成长阶段（0–6/7–13/14+）別の程序化差分 — 色调（S-07: 色调/缩放/表情贴片のうち色调＋缩放） */
  STAGE_TINTS: [0x963a16, 0xb45a24, 0xd4813a],
  STAGE_SCALES: [1, 1.15, 1.3],
  SELECTED_STROKE: 0xf0c182,
  SELECTED_STROKE_WIDTH: 4,
  LABEL_FONT_SIZE: '15px',
  DISH_FONT_SIZE: '15px',
  ZONE_PREFIX: 'game.',
  /** 晨间引导超时の「开门营业」按钮脉冲（周期 ms — 実装演出定数） */
  GUIDE_PULSE_MS: 600,
  GUIDE_PULSE_SCALE: 1.06,
} as const;

// ==== 玩法点击判定区（InputRouter 登録。优先级は INPUT_PRIORITY の既定档を使用）====
export const GAMEPLAY_ZONES = {
  AMBITION: (ambitionId: string): string => `game.ambition.${ambitionId}`,
  POST: (index: number): string => `game.morning.post.${index}`,
  STAFF_AVATAR: (staffId: string): string => `game.morning.staff.${staffId}`,
  OPEN_DOOR: 'game.morning.openDoor',
  TABLE: (customerId: number): string => `game.day.table.${customerId}`,
  SERVE_DISH: (customerId: number): string => `game.day.serve.${customerId}`,
  PAYMENT: (customerId: number): string => `game.day.pay.${customerId}`,
  DRAW_CARD: 'game.night.draw',
  CARD_OPTION: (index: number): string => `game.night.option.${index}`,
  DAYBREAK: 'game.night.daybreak',
} as const;
