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
    // BGM-01/02（S-31 Phase 3 落盘 — design/assets.md「生成实绩」。OGG+M4A 双格式、循环前提。
    // 循环播放与轨道选择是 S-27 AudioDirector — 用途划分见 assets.md「BGM」节）
    bgmInnDay: 'assets/audio/bgm-inn-day', // BGM-01（Title/Menu/晨/日/夜 的基础氛围）
    bgmFinalBattle: 'assets/audio/bgm-final-battle', // BGM-02（第 20 日夜终战）
  },

  // 背景/精灵（S-33: IMG-01～30 正式资产 — design/assets.md。登録は S-32 コミットに同梱）
  // 値 = assets/ 下のパス = そのまま Phaser のテクスチャキー。※audio と異なり .png 拡張子を含む
  // （audio は OGG/M4A 双形式展開のため拡張子なし — 規約は同一ではない点に注意）。
  // 表示サイズは SPRITE_DISPLAY、実体との対応づけは systems/visualAssets.ts に集約）
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
    menuFullPanel: 'ui/menu-full-panel', // S-26 图鉴/成就/统计 3 节モーダル（MENU.FULL_PANEL_WIDTH x HEIGHT）
    resultPanel: 'ui/result-panel', // S-15 Result 总评分面板（RESULT.PANEL_WIDTH x HEIGHT）
    titleEmblem: 'ui/title-emblem', // S-12 Title emblem 占位（TITLE.EMBLEM_SIZE 正方形）
  },
} as const;

// IMG-30 のグリッド切分规格（1536x1024 → COLS x ROWS = 3x2 帧。assets.md「IMG-30 的切分」。
// COLS/ROWS は BootScene の sheet fallback（CR-CODE iteration 1 finding 4）でも同一参照）
export const IMG_SHEET_FRAME = { WIDTH: 512, HEIGHT: 512, COLS: 3, ROWS: 2 } as const;

// ==== 立绘/物件の表示サイズ（S-33 — design/assets.md「尺寸」栏の游戏内表示値。px）====
export const SPRITE_DISPLAY = {
  /** 伙计/客人立绘（assets.md: 192–256px） */
  STAFF_AVATAR_HEIGHT: 96, // 晨间头像框内（MORNING.AVATAR_WIDTH/HEIGHT に収める框内表示）
  GUEST_HEIGHT: 192, // 桌に着席する客人（等比。192–256px 带の下限）
  WAITER_MARKER_HEIGHT: 112, // 日间の跑堂移動体
  /** 大敌（assets.md: ~320px） */
  RIVAL_HEIGHT: 320,
  /** 菜品图标（assets.md: 64–96px 带の下限）/ 出餐口棚では棚セルに合わせて縮小 */
  DISH_BUBBLE_SIZE: 72,
  DISH_RACK_SIZE: 48,
  /** 圆桌（assets.md: ~160px） */
  TABLE_SIZE: 160,
  /** 志向图标（assets.md: 64–96px 带。按钮上の空き帯に収るサイズ） */
  AMBITION_ICON_SIZE: 72,
  /** 事件卡框（assets.md: ~400x600。源图 1024x1536 = 2:3 で addScaledSprite の等比縮小が
   * 幅 400 を自動的に満たすため幅指定は持たない — CR-CODE iteration 1 finding 7 で削除） */
  EVENT_CARD_HEIGHT: 600,
  /** 标题 emblem（assets.md: ~640x427。中央を空けた装飾 — タイトル文を中央に重ねる） */
  TITLE_EMBLEM_WIDTH: 640,
  TITLE_EMBLEM_HEIGHT: 427,
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
  // 覆盖 0.5x/2x 窗口尺寸（≤2560px 宽）的 acceptance。上限注记: 固定 2x 在更宽窗口
  // （4K ≈ 3x FIT 放大）下会低于有效渲染分辨率 — 若需覆盖，改为从 window.devicePixelRatio
  // 推导。全部 Text 一律经由本常量，禁止散置魔法数字）
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

// ==== 资产欠落 fallback（S-33 — IMG 资产未落盘时的程序化代用纹理。
// BootScene が ASSET_KEYS.images/spriteSheets の全キーに対し未登録分へ適用。
// 正常時（S-30 落盘後）は一切描画されない — 欠落を目立たせるための无地プレート）====
export const ASSET_FALLBACK = {
  SIZE: 256,
  FILL: UI.PANEL_FILL,
  STROKE: UI.PANEL_STROKE,
  STROKE_WIDTH: UI.PANEL_STROKE_WIDTH,
  /** sheet fallback の帧区画の市松明度差（帧番号の視認 — BootScene.generateFallbackSheetTexture） */
  CELL_ALPHAS: [1, 0.78],
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

  // 标题（败局 / 周目结果。2 行换行的结局文の伸長領域を確保するため S-25 fix で -158 → -176）
  TITLE_OFFSET_Y: -176,
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

  // ==== S-25: Result 结局演出完整版（结局插画/结局文/败局演出/新纪录标记。追加のみ —
  // 既存キー（S-15 レイアウト）は不変。配色は UI.PANEL_* / HUD_* の調色板定数を再利用）====
  /** 结局文/败局文（**下端锚定** — 多行换行でも上方向へ伸長し、总评分ラベルとの間隔は一定
   *  （S-25 fix: 旧 -122 上端锚定では 2 行換行時に SCORE_LABEL と叠字）。标题側は
   *  TITLE_OFFSET_Y -176 へ退避 — 2 行換行まで非重叠。文案は systems/i18n の言語表） */
  BODY_OFFSET_Y: -110,
  BODY_FONT_SIZE: '15px',
  BODY_WRAP_WIDTH: 520,

  /** 结局插画（IMG-26～28。画面全覆盖 cover 拡縮 — 比率はテクスチャ実寸から導出、直書きなし） */
  ENDING_IMAGE: {
    wealth: ASSET_KEYS.images.endingWealth,
    xia: ASSET_KEYS.images.endingXia,
    fame: ASSET_KEYS.images.endingRenown,
  } as const,
  /** 插画上の变暗遮罩（结局文・评分の可読性確保 — BLOCKER_COLOR を暗転に使用） */
  ENDING_OVERLAY_ALPHA: 0.55,

  /** 新纪录标记（总评分值の右侧。脉动闪烁 — delta-driven tween） */
  NEW_RECORD_X_OFFSET: 132,
  NEW_RECORD_FONT_SIZE: '17px',
  NEW_RECORD_PULSE_MS: 700,
  NEW_RECORD_ALPHA_MIN: 0.55,

  /** 破产演出「账本合上」（面板中央に重ねて閉じ→フェードアウト — パネル内容を顕す） */
  LEDGER_WIDTH: 230,
  LEDGER_HEIGHT: 150,
  LEDGER_PAGE_FILL: UI.PANEL_BRIGHT_ACCENT,
  LEDGER_PAGE_ALPHA: 0.9,
  LEDGER_COVER_FILL: UI.PANEL_FILL,
  LEDGER_COVER_STROKE: UI.PANEL_ACCENT,
  LEDGER_COVER_STROKE_WIDTH: UI.PANEL_ACCENT_WIDTH,
  /** 開帳角度（deg。右表紙が上へ開いた初期姿 — 0 で全閉） */
  LEDGER_OPEN_ANGLE: 105,
  LEDGER_CLOSE_MS: 650,
  LEDGER_HOLD_MS: 450,
  LEDGER_FADE_MS: 400,
  LEDGER_SPINE_INSET: 4,

  /** 终战败演出（全画面への朱 flash — 短時間・入力は妨げない。色は GAMEPLAY.STAFF_FILL の朱 =
   *  art-bible 調色板 accent — 数値定数は UI.HUD_FLASH_DOWN_COLOR の文字列形式では不可のため
   *  同一パレット色の数値版 GAMEPLAY.STAFF_FILL を使用側で参照） */
  DEFEAT_FLASH_ALPHA: 0.32,
  DEFEAT_FLASH_MS: 650,
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

  // ==== S-26: 图鉴/成就/统计 3 节「游戏外显示」完整版モーダル（设置面板は既有 PANEL_* を継続使用。
  // 座標は GAME_WIDTH/HEIGHT 基準分辨率の絶対値。配色は UI.PANEL_* 系の参照に加え、
  // ロック态のみ art-bible 调色板由来の直書き値（SLOT_FILL_LOCKED / LOCKED_TEXT_COLOR）====
  FULL_PANEL_WIDTH: 880,
  FULL_PANEL_HEIGHT: 480,
  FULL_PANEL_TITLE_OFFSET_Y: 44,
  FULL_PANEL_TITLE_FONT_SIZE: '26px',
  // 3 节の列中心（GAME_WIDTH/2 からの offset。左=结局图鉴 / 中=成就 / 右=统计）
  SECTION_COLUMN_X_OFFSETS: [-280, 0, 280] as readonly number[],
  SECTION_HEADER_Y: 208,
  SECTION_HEADER_FONT_SIZE: '20px',
  // 结局图鉴 3 格（SLOT_GAP = 格中心間隔）
  SLOT_WIDTH: 80,
  SLOT_HEIGHT: 92,
  SLOT_GAP: 96,
  SLOT_Y: 268,
  SLOT_LABEL_OFFSET_Y: 62,
  SLOT_LABEL_FONT_SIZE: '14px',
  // 解锁/锁定态配色（调色板: unlocked=金 accent 系 / locked=暗褐 + 中间褐文字）
  SLOT_FILL_UNLOCKED: UI.PANEL_ACCENT,
  SLOT_FILL_LOCKED: 0x3c2410,
  SLOT_FILL_ALPHA: 0.92,
  SLOT_STROKE: UI.PANEL_STROKE,
  SLOT_STROKE_WIDTH: 2,
  LOCKED_TEXT_COLOR: '#A76E3C',
  UNLOCKED_TEXT_COLOR: UI.HUD_TEXT_COLOR,
  // ACH-04 进度（图鉴完成 n/3。进度条=track+fill 2 矩形）
  ACH04_LABEL_Y: 376,
  ACH04_LABEL_FONT_SIZE: '16px',
  ACH04_BAR_Y: 398,
  ACH04_BAR_WIDTH: 200,
  ACH04_BAR_HEIGHT: 14,
  ACH04_VALUE_FONT_SIZE: '15px',
  /** ACH-04 进度条右端 → 「n / 3」数值文字の左端までの隙間 */
  ACH04_VALUE_X_GAP: 14,
  // 成就一览（6 行）/ 统计（5 行）共通の行レイアウト
  ROW_START_Y: 244,
  ROW_GAP: 40,
  ROW_FONT_SIZE: '17px',
  ACH_NAME_X_OFFSET: -120,
  ACH_STATE_X_OFFSET: 120,
  STATS_LABEL_X_OFFSET: -130,
  STATS_VALUE_X_OFFSET: 130,
  FULL_PANEL_CLOSE_Y: 556,
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

// ==== 终战（S-19 finalBattle。出处: gdd「数值表」「胜负条件」— 常量名 = GDD 数值表原样）====
/** 终战回合数（gdd: BATTLE_ROUNDS。演出约 40s） */
export const BATTLE_ROUNDS = 3;
/** 先取胜所需回合数（gdd「胜负条件」: 先取 2 胜者胜） */
export const BATTLE_ROUNDS_TO_WIN = 2;
/** 单回合战力随机波动（gdd: BATTLE_VARIANCE。敌我同率 — gdd 算式 1±0.15。有悬念但不逆转养成差距） */
export const BATTLE_VARIANCE = 0.15;
/** 终战大敌战力（gdd: ENEMY_POWER） */
export const ENEMY_POWER = 32;
/** 雇镖师援助费用（gdd: BATTLE_AID_COST。P-03 财线以银子补战力的通道） */
export const BATTLE_AID_COST = 100;
/** 雇镖师援助战力（gdd: AID_POWER） */
export const BATTLE_AID_POWER = 8;

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

  // ---- 客人类型（S-16。出处: gdd「敌人与障碍物」「难度曲线」表）----
  /** 镖师初日（第 4 日起登場、权重渐增） */
  ESCORT_FIRST_DAY: 4,
  /** 老饕初日（第 7 日起登場 — gdd「难度曲线」D4–9 段の後半） */
  GOURMET_FIRST_DAY: 7,
  /** 镖师の点菜数（点 2 菜 — 2 枚とも制菜・上菜が必要） */
  ESCORT_DISH_COUNT: 2,
  /** 老饕が生成される当日可选菜种の下限（<4 = 4 号以上菜なし → 散客で代替 — gdd「敌人与障碍物」） */
  GOURMET_MIN_DISH_KINDS: 4,
  /** 老饕の指定高级菜の菜号下限（4〜6 号菜） */
  GOURMET_DISH_ID_MIN: 4,
  /** 耐心の类型倍率（基礎耐心 × 本値。無采购 −10s は倍率適用後に減算 — gdd「难度曲线」注记） */
  PATIENCE_FACTOR_ESCORT: 1.3,
  PATIENCE_FACTOR_GOURMET: 0.8,
  /** 服务成功の声望: 散客/镖师 +1（SERVE_SUCCESS_REPUTATION）、老饕 +2（gdd「分数与进度」） */
  SERVE_SUCCESS_REPUTATION_GOURMET: 2,
  /** 耐心归零離店の声望惩罚: 散客 −2（LEAVE_REPUTATION_PENALTY）、镖师 −3、老饕 −4 */
  LEAVE_REPUTATION_PENALTY_ESCORT: 3,
  LEAVE_REPUTATION_PENALTY_GOURMET: 4,
  /**
   * 出現权重（到達 1 回ごとの抽選に使用。gdd は「权重渐增」・老饕 ≈10% のみ指定 —
   * 段階別の具体值は実装側初始值。調整は本定数のみ）
   */
  ESCORT_WEIGHT_D4_9: 0.1,
  ESCORT_WEIGHT_D10_15: 0.15,
  ESCORT_WEIGHT_D16_20: 0.2,
  GOURMET_WEIGHT_D7_9: 0.05,
  GOURMET_WEIGHT_D10_15: 0.1,
  GOURMET_WEIGHT_D16_20: 0.15,
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
  /** 事件卡导致的伙计疲劳概率（gdd「事件卡」テンプレート: 疲劳概率 ≤20%。
   * roll 与施加は S-18 接线 — 卡数据表の mayFatigue 标记と対で使う） */
  FATIGUE_CHANCE: 0.2,
  /** gdd「事件卡」效果幅度模板の境界（systems/eventCardData.ts の效果幅度コメントが
   * 参照先として本定数を指す。幅の統一改変はここ一箇所で行う — コードからの参照は
   * まだ無く、検証テスト lane での参照を想定した先行定義。卡数据表の每卡具体値は
   * 内容データなので直値のまま） */
  SILVER_DELTA_MIN: -25,
  SILVER_DELTA_MAX: 15,
  REPUTATION_DELTA_MIN: -10,
  REPUTATION_DELTA_MAX: 10,
  XIA_POINT_MAX: 5,
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
  /** 志向图标（IMG-22～24。按钮と hint 文の間の空き帯に收める — ボタン中央 y からのオフセット） */
  ICON_OFFSET_Y: -84,
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
  /** 名前ラベルの縦オフセット（头像中心から。CR-CODE iter1 finding 3: 表情贴片の顔域
   *  （0.4×表示高さ−MOUTH_FROWN_DY 上端）と重ならない位置へ S-07 の直書き 26 から移動） */
  AVATAR_NAME_OFFSET_Y: 18,
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

  // ==== 资产表示の配置（S-33。IMG スプライト化に伴う位置・サイズ定数）====
  /** 客人立绘（桌に着席 — 桌中心からのオフセット。テーブルより奥に見える配置） */
  GUEST_OFFSET_Y: -80,
  /** 立绘の上に重ねる半透明ステージティント（CR-CODE iteration 1 finding 6: 注記を実描画順に一致。
   * GameplayView で rect は sprite の後に add され、STAGE_TINTS の 28% が立绘上の蒙層として乗る —
   * S-07 成长差分（色调＋缩放）の色调はこの蒙層で表現。垫底（後ろに敷く）ではない） */
  SPRITE_PLATE_ALPHA: 0.28,
  /** 点单/上菜/收钱气泡の桌中心からのオフセット（従来の直書き 52 を定数化） */
  BUBBLE_OFFSET_Y: -52,
  /** 出餐口の出来上がり菜ラック（SERVE_WINDOW からのオフセットとセル寸法） */
  SERVE_RACK_X_OFFSET: -56,
  SERVE_RACK_Y_OFFSET: 40,
  SERVE_RACK_CELL: 56,
  /** 跑堂マーカーの名前ラベル（スプライト下端のオフセット） */
  MARKER_NAME_OFFSET_Y: 64,
  /** 跑堂の待機位置（柜台に横並び — 従来の直書き 40 を定数化） */
  WAITER_STAND_GAP: 40,
  /** 大敌立绘（终战の夜。夜パネルの左側に表示） */
  RIVAL_SPRITE: { x: 170, y: 400 },
  /** 耐心バーの桌中心からのオフセット（従来の直書き 56 を定数化） */
  PATIENCE_BAR_OFFSET_Y: 56,
  // 柜台/出餐口プレート（IMG 资产の無い施設。枠线付きパネル — 従来の直書きを定数化）
  COUNTER_WIDTH: 160,
  COUNTER_HEIGHT: 48,
  SERVE_WINDOW_WIDTH: 120,
  SERVE_WINDOW_HEIGHT: 56,
  SERVE_LABEL_OFFSET_Y: 40,
} as const;

// ==== S-28 成长差分强化（程序化演出パラメータ — gdd「伙计初始值」差分表。新規资产なし）====
export const STAGE_FX = {
  /**
   * 伙计別の成长阶段色调（plate 蒙层色 — GAMEPLAY.STAGE_TINTS の伙计別版。
   * gdd 差分表: 5 名各自の ramp（低位=沈、高阶=明るい暖色へ）。未登记 id は
   * GAMEPLAY.STAGE_TINTS にフォールバック（unlock 伙计 IMG-09/10）。
   */
  TINTS_BY_STAFF: {
    afu: [0x963a16, 0xb45a24, 0xd4813a],
    tieniu: [0x5a2a14, 0x8a3c1c, 0xc06a2c],
    wenqu: [0x4a3a58, 0x6a5478, 0x9a7f9e],
    xiaodie: [0x3a5a2e, 0x55793e, 0x7fa055],
    dasong: [0x2e3a4a, 0x3f5468, 0x5a7386],
  } as Readonly<Record<string, readonly [number, number, number]>>,
  /** 跑堂移動ボブ（移動中の上下弾み — 阶段が上がるほど弾み大・頻度大 = 目視できる速度差） */
  BOB_AMP_PX: [2, 4, 6],
  BOB_FREQ_HZ: [1.6, 2.2, 3.0],
  /** 小蝶の低位「同手同脚」ぐらつき（sprite 回転角 — 度。他の伙计/高阶段は 0） */
  WADDLE_DEG: 7,
  /** 阿福の高阶「残影」（跑堂移動中に立绘 ghost を等間隔で残す） */
  TRAIL_INTERVAL_MS: 90,
  TRAIL_ALPHA: 0.35,
  TRAIL_FADE_MS: 260,
  /** 铁牛の低位「制菜冒黑烟」（制菜 ticket 進行中、掌勺が成长阶段 0 のとき柜台上に立ち上る） */
  SMOKE_INTERVAL_MS: 200,
  SMOKE_RADIUS: 7,
  SMOKE_COLOR: 0x2a2138,
  SMOKE_ALPHA: 0.5,
  SMOKE_RISE_PX: 46,
  SMOKE_DRIFT_X: 10,
  SMOKE_FADE_MS: 900,
  SMOKE_END_SCALE: 1.6,
  /** 铁牛（掌勺）の高阶「出菜带金光」（出餐口 rack の出来上がり菜に金色パルス） */
  GLOW_RADIUS: 26,
  GLOW_COLOR: 0xf0c182,
  GLOW_ALPHA: 0.4,
  GLOW_PULSE_MS: 700,
  GLOW_PULSE_SCALE: 1.25,
  /** 表情贴片（ Graphics 描画 — 眼 2 点＋口弧。阶段: 0=しょんぼり/1=真顔/2=笑顔）
   *  CR-CODE iter1 finding 3: 顔域を名前ラベル（AVATAR_NAME_OFFSET_Y）の上側に退避 —
   *  HEAD_FROM_TOP_RATIO を下げて貼片全体（口下端 = 0.4×表示高さ−MOUTH_FROWN_DY）を
   *  ラベル帯（中心から 18−8〜18+8px）より上に置く（最小缩放 1.0 でも 3px 以上の空き） */
  EXPRESSION: {
    /** 立绘表示高さに対する顔中心の位置（立绘上端からの比率） */
    HEAD_FROM_TOP_RATIO: 0.10,
    EYE_DX: 4,
    EYE_RADIUS: 2,
    MOUTH_RADIUS: 4,
    MOUTH_SMILE_DY: 5,
    MOUTH_FROWN_DY: 9,
    /** 口弧の端の切り欠き（radian — 弧を描きすぎて完全半円にならないようの余白） */
    MOUTH_ARC_INSET: 0.35,
    LINE_WIDTH: 2,
    COLOR: 0x281d10,
  },
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
  // 终战（S-19: 开战前选择。「雇镖师援助」は银子不足/雇入济み時に判定区ごと不登録＝不活性）
  AID_HIRE: 'game.battle.aid',
  FIGHT_CONFIRM: 'game.battle.fight',
} as const;

// ==== 终战夜面板（S-19。夜パネル（NIGHT.PANEL_X/Y）内に重ねる — レイアウトはオフセットで导出）====
export const BATTLE_UI = {
  /** 战力表示行（player/enemy 2 行。摘要行と同型の左右配置） */
  POWER_LINE_START_OFFSET_Y: -130,
  POWER_LINE_GAP: 42,
  POWER_FONT_SIZE: '19px',
  /** 战力行のラベル列／値列の横オフセット（パネル中心基準。CR-CODE iter1 finding 4） */
  POWER_LABEL_OFFSET_X: -180,
  POWER_VALUE_OFFSET_X: 180,
  /** 援助の费用/战力表示行（值側は config の BATTLE_AID_COST/BATTLE_AID_POWER を补间） */
  AID_INFO_OFFSET_Y: -30,
  AID_INFO_FONT_SIZE: '15px',
  AID_BUTTON_OFFSET_Y: 90,
  FIGHT_BUTTON_OFFSET_Y: 200,
  /** 援助不可（银子不足/雇入济み）时の按钮不活性表示（判定区ごと未登録 — 点击不発） */
  DISABLED_ALPHA: 0.4,
} as const;

// ==== 音频接线（S-27 — BGM 循环与 SFX 复用变调。design/assets.md「音频」节）====
export const AUDIO = {
  /**
   * SFX 复用变调变体（assets.md「复用映射」: 变调一律由 Phaser 侧 detune/rate 承担、
   * 不新增文件）。detune = 音分（100 = 半音）/ rate = 播放速度 /
   * volumeScale = 对 sfx_volume 的倍率（输出时 clamp 到 SFX_VOLUME_MAX）。
   */
  SFX_VARIANTS: {
    trainingDone: { detune: 400, rate: 1, volumeScale: 1.2 }, // 修练完成 = SFX-01 高音量＋升调
    postAssign: { detune: -200, rate: 1, volumeScale: 0.9 }, // 晨间岗位指派确认（两次点击的第二击。变调/音量差区分场景）
    cardConfirm: { detune: 300, rate: 1.35, volumeScale: 0.85 }, // 事件卡选项确定 = SFX-07 尾段纸页音
    bankruptcy: { detune: -400, rate: 0.6, volumeScale: 1 }, // 破产败局 = SFX-06 低速变调
  },
  /** SFX 实效输出上限（sfx_volume × volumeScale 的 clamp 值 — >1 会 clip） */
  SFX_VOLUME_MAX: 1,
} as const;

/** SFX 复用变调变体 id（config.AUDIO.SFX_VARIANTS 的键 — 变体追加只动上面的表） */
export type SfxVariantId = keyof typeof AUDIO.SFX_VARIANTS;
