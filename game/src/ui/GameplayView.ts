/**
 * GameplayView — GameScene の玩法表示（S-02/S-03/S-05/S-06/S-09 の視覚化）。
 *
 * - 显示值は全部 Systems 层の RunState から導出（ui-code 规范: 双重管理禁止）。
 *   本クラスは「受けて描く」だけ Navystate を持有しない（dynamic 表示用の描画物参照のみ）。
 * - 構造（相位/客人構成/夜段階/選択岗位…）が変わった時だけ再構築し、
 *   每フレーム更新は waiter 移動・耐心バー・日间進行バーのみ（GC 負荷を抑える）。
 * - 点击判定は InputRouter へ登録（優先度仲裁は input 层 — conventions 规则 7）。
 * - IMG 资产の表示（S-33）: 実体 ↔ 資産キーの対応は systems/visualAssets.ts、
 *   サイズは SPRITE_DISPLAY、配置は ui/assetSprites.ts のヘルパに集約。
 */
import Phaser from 'phaser';
import {
  AMBITION_UI,
  ASSET_KEYS,
  BATTLE_AID_COST,
  BATTLE_AID_POWER,
  BATTLE_UI,
  CUSTOMER,
  DAY_CYCLE,
  ENEMY_POWER,
  GAMEPLAY,
  GAMEPLAY_ZONES,
  GAME_LAYOUT,
  GAME_WIDTH,
  INPUT_PRIORITY,
  MORNING,
  MS_PER_SECOND,
  NIGHT,
  POST_CAPACITY,
  SPRITE_DISPLAY,
  STAGE_FX,
  UI,
} from '../config';
import type { InputRouter } from '../systems/input/InputRouter';
import { AMBITION_PACKS } from '../systems/ambition';
import { canHireAid, playerPowerOf } from '../systems/finalBattle';
import { EVENT_CARD_POOL } from '../systems/eventCardData';
import { getLanguage } from '../systems/i18n';
import { growthStage } from '../systems/training';
import {
  ambitionIconKey,
  backgroundKeyForPhase,
  dishSpriteKey,
  guestSpriteKey,
  staffSpriteKey,
} from '../systems/visualAssets';
import { addCoverBackground, addScaledSprite } from './assetSprites';
import { headChefFx, staffStagePresentation, type HeadChefFx, type StagePresentation } from './stagePresentation';
import { HUD_TEXT_KEYS, TEXT_KEYS } from '../textKeys';
import {
  TAP_EVENTS,
  type AmbitionId,
  type PostId,
  type RunState,
  type TapEventName,
  type TextProvider,
} from '../types';

interface PostDefinition {
  readonly id: PostId;
  readonly labelKey: string;
}

/** 志向 id → 表示文案 key（S-04 選択ボタン。文案は systems/i18n 言語表） */
const AMBITION_LABEL_KEYS: Readonly<Record<AmbitionId, string>> = {
  wealth: TEXT_KEYS.AMBITION_WEALTH_LABEL,
  xia: TEXT_KEYS.AMBITION_XIA_LABEL,
  fame: TEXT_KEYS.AMBITION_FAME_LABEL,
};

const POST_DEFINITIONS: readonly PostDefinition[] = [
  { id: 'waiter', labelKey: TEXT_KEYS.POST_WAITER },
  { id: 'manager', labelKey: TEXT_KEYS.POST_MANAGER },
  { id: 'purchaser', labelKey: TEXT_KEYS.POST_PURCHASER },
  { id: 'training', labelKey: TEXT_KEYS.POST_TRAINING },
];

const STAGE_DOTS = ['○○○', '●○○', '●●○'];

/** 配列インデックス参照の undefined 抑止（index は常に範囲内 — 布局定数は固定長） */
function pointAt(list: readonly { readonly x: number; readonly y: number }[], index: number) {
  return list[index] as { readonly x: number; readonly y: number };
}

/** 跑堂 marker の表示参照（S-28 motion/残影演出用の描画キャッシュ — state の正は Systems 側） */
interface WaiterMarkerView {
  readonly container: Phaser.GameObjects.Container;
  readonly sprite: Phaser.GameObjects.Image | null;
  readonly spriteKey: string | null;
  readonly displayHeight: number;
  readonly presentation: StagePresentation;
  /** ボブ位相・残影スパン（delta で進める演出キャッシュ — systems state の複製ではない） */
  bobPhaseMs: number;
  trailTimerMs: number;
}

export class GameplayView {
  private container: Phaser.GameObjects.Container | null = null;
  private structuralKey = '';
  private readonly zoneIds = new Set<string>();
  private readonly patienceBars = new Map<number, Phaser.GameObjects.Rectangle>();
  private readonly waiterMarkers = new Map<string, WaiterMarkerView>();
  private progressFill: Phaser.GameObjects.Rectangle | null = null;
  private pulseTween: Phaser.Tweens.Tween | null = null;
  /** 当日の黑烟/金光表示条件（S-28 — buildDay での表示導出キャッシュ。正は Systems の RunState） */
  private dayHeadChefFx: HeadChefFx = { smoke: false, glow: false };
  /** 黑烟の emission 間隔キャッシュ（delta 驱动 — S-28） */
  private smokeTimerMs = 0;
  /** rebuild 寿命の無限 tween（出菜金光パルス — 前回描画分を確実に停止） */
  private readonly rebuildTweens: Phaser.Tweens.Tween[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly textProvider: TextProvider,
    private readonly router: InputRouter,
  ) {}

  render(run: RunState, deltaMs = 0): void {
    const key = this.buildStructuralKey(run);
    if (key !== this.structuralKey || this.container === null) {
      this.rebuild(run);
      this.structuralKey = key;
    }
    this.updateDynamic(run, deltaMs);
  }

  destroy(): void {
    this.unregisterZones();
    this.container?.destroy(true);
    this.container = null;
    this.pulseTween?.remove();
    this.pulseTween = null;
    for (const tween of this.rebuildTweens) {
      tween.remove();
    }
    this.rebuildTweens.length = 0;
  }

  // ==== 構造キー（変わった時だけ再構築）====

  private buildStructuralKey(run: RunState): string {
    return [
      getLanguage(),
      run.phase,
      run.day,
      run.nightStage,
      run.drawnCard === null ? '-' : `${run.drawnCard.cardId}:${run.drawnCard.chosenIndex}`,
      run.selectedPost ?? '-',
      run.noticeKey ?? '-',
      run.finalBattleNight ? 'F' : '-',
      // 终战状态/雇援助（S-19）: hireAid で status/aidHired 以外（nightStage/day/岗位）が
      // 不変のため、戦力表示＋援助按钮の不活性を反映させるには鍵への組込みが必須
      // （CR-CODE iter1 finding 2）
      run.finalBattle ? `${run.finalBattle.status}:${run.finalBattle.aidHired}` : '-',
      run.staff.map((member) => member.post).join(','),
      run.customers.map((customer) => `${customer.id}:${customer.stage}`).join(','),
      run.kitchen.ready.map((dish) => dish.customerId).join(','),
      run.kitchen.tickets.length,
    ].join('|');
  }

  // ==== 再構築 ====

  private rebuild(run: RunState): void {
    this.unregisterZones();
    this.patienceBars.clear();
    this.waiterMarkers.clear();
    this.progressFill = null;
    this.dayHeadChefFx = { smoke: false, glow: false };
    this.smokeTimerMs = 0;
    this.pulseTween?.remove();
    this.pulseTween = null;
    for (const tween of this.rebuildTweens) {
      tween.remove();
    }
    this.rebuildTweens.length = 0;
    this.container?.destroy(true);

    const container = this.scene.add.container(0, 0).setDepth(UI.DEPTH_HUD - 1);
    this.container = container;

    switch (run.phase) {
      case 'ambition':
        this.buildAmbition(run, container);
        return;
      case 'morning':
        this.buildMorning(run, container);
        return;
      case 'day':
        this.buildDay(run, container);
        return;
      case 'night':
        this.buildNight(run, container);
        return;
    }
  }

  private buildAmbition(_run: RunState, container: Phaser.GameObjects.Container): void {
    container.add(addCoverBackground(this.scene, backgroundKeyForPhase('ambition')));
    container.add(
      this.label(
        GAME_WIDTH / 2,
        AMBITION_UI.TITLE_Y,
        this.textProvider(TEXT_KEYS.AMBITION_TITLE),
        AMBITION_UI.TITLE_FONT_SIZE,
      ),
    );
    container.add(
      this.label(GAME_WIDTH / 2, AMBITION_UI.HINT_Y, this.textProvider(TEXT_KEYS.AMBITION_HINT), AMBITION_UI.HINT_FONT_SIZE),
    );

    // 財/侠/名 3 按钮（S-04: ≥48px — AMBITION_UI.BUTTON_WIDTH/HEIGHT。初期值も併記）
    AMBITION_PACKS.forEach((pack, index) => {
      const position = pointAt(AMBITION_UI.BUTTONS, index);
      // 志向图标（IMG-22～24 — ボタン上端の上に配置）
      container.add(
        addScaledSprite(
          this.scene,
          ambitionIconKey(pack.id),
          position.x,
          position.y + AMBITION_UI.ICON_OFFSET_Y,
          SPRITE_DISPLAY.AMBITION_ICON_SIZE,
        ),
      );
      const rect = this.scene.add
        .rectangle(
          position.x,
          position.y,
          AMBITION_UI.BUTTON_WIDTH,
          AMBITION_UI.BUTTON_HEIGHT,
          UI.PANEL_FILL,
          UI.PANEL_FILL_ALPHA,
        )
        .setStrokeStyle(UI.PANEL_STROKE_WIDTH, UI.PANEL_STROKE);
      container.add(rect);
      container.add(
        this.label(
          position.x,
          position.y - 16,
          this.textProvider(AMBITION_LABEL_KEYS[pack.id]),
          AMBITION_UI.LABEL_FONT_SIZE,
        ),
      );
      container.add(
        this.label(
          position.x,
          position.y + 20,
          `${this.textProvider(HUD_TEXT_KEYS.HUD_SILVER)} ${pack.silverStart} / ` +
            `${this.textProvider(HUD_TEXT_KEYS.HUD_REPUTATION)} ${pack.reputationStart}`,
          AMBITION_UI.VALUE_FONT_SIZE,
        ),
      );
      this.registerZone(GAMEPLAY_ZONES.AMBITION(pack.id), position, AMBITION_UI.BUTTON_WIDTH, AMBITION_UI.BUTTON_HEIGHT, {
        event: TAP_EVENTS.AMBITION_CONFIRM,
        priority: INPUT_PRIORITY.TABLE_ORDER,
        payload: { ambitionId: pack.id },
      });
    });
  }

  private buildMorning(run: RunState, container: Phaser.GameObjects.Container): void {
    container.add(addCoverBackground(this.scene, backgroundKeyForPhase('morning')));
    container.add(
      this.label(GAME_WIDTH / 2, MORNING.TITLE_Y, this.textProvider(TEXT_KEYS.MORNING_TITLE), MORNING.TITLE_FONT_SIZE),
    );

    const hintKey =
      run.noticeKey ??
      (run.selectedPost === null
        ? TEXT_KEYS.MORNING_HINT_SELECT_POST
        : TEXT_KEYS.MORNING_HINT_SELECT_STAFF);
    container.add(
      this.label(GAME_WIDTH / 2, MORNING.HINT_Y, this.textProvider(hintKey), MORNING.HINT_FONT_SIZE),
    );

    POST_DEFINITIONS.forEach((post, index) => {
      const position = pointAt(MORNING.POSTS, index);
      const assigned = run.staff.filter((member) => member.post === post.id).length;
      const rect = this.scene.add
        .rectangle(position.x, position.y, MORNING.POST_WIDTH, MORNING.POST_HEIGHT, UI.PANEL_FILL, UI.PANEL_FILL_ALPHA)
        .setStrokeStyle(
          run.selectedPost === post.id ? GAMEPLAY.SELECTED_STROKE_WIDTH : UI.PANEL_STROKE_WIDTH,
          run.selectedPost === post.id ? GAMEPLAY.SELECTED_STROKE : UI.PANEL_STROKE,
        );
      container.add(rect);
      container.add(
        this.label(position.x, position.y - 12, this.textProvider(post.labelKey), MORNING.POST_FONT_SIZE),
      );
      container.add(
        this.label(
          position.x,
          position.y + 14,
          `${assigned}/${POST_CAPACITY[post.id]}`,
          MORNING.CAPACITY_FONT_SIZE,
        ),
      );
      this.registerZone(GAMEPLAY_ZONES.POST(index), position, MORNING.POST_WIDTH, MORNING.POST_HEIGHT, {
        event: TAP_EVENTS.ASSIGN_SLOT,
        priority: INPUT_PRIORITY.TABLE_ORDER,
        payload: { postId: post.id },
      });
    });

    run.staff.forEach((member, index) => {
      const position = pointAt(MORNING.AVATARS, index);
      const total = member.speed + member.craft + member.stamina;
      const stage = growthStage(total);
      const presentation = staffStagePresentation(member.id, stage);
      // 伙计立绘（IMG-04～10 — systems/visualAssets.ts の対応づけ。選択表示は枠线 rect が担う）
      const spriteKey = staffSpriteKey(member.id);
      let avatarSprite: Phaser.GameObjects.Image | null = null;
      if (spriteKey !== null) {
        const sprite = addScaledSprite(
          this.scene,
          spriteKey,
          position.x,
          position.y,
          MORNING.AVATAR_HEIGHT,
        );
        // 成长阶段別の差分（S-07）: 立绘の表示倍率（缩放 — STAGE_SCALES）
        sprite.setScale(sprite.scale * GAMEPLAY.STAGE_SCALES[stage]);
        avatarSprite = sprite;
        container.add(sprite);
      }
      const rect = this.scene.add
        .rectangle(
          position.x,
          position.y,
          MORNING.AVATAR_WIDTH,
          MORNING.AVATAR_HEIGHT,
          GAMEPLAY.STAFF_FILL,
          GAMEPLAY.SPRITE_PLATE_ALPHA,
        )
        .setStrokeStyle(UI.PANEL_STROKE_WIDTH, UI.PANEL_STROKE);
      container.add(rect);
      container.add(
        this.label(
          position.x,
          position.y - MORNING.AVATAR_NAME_OFFSET_Y,
          this.textProvider(member.nameKey),
          MORNING.AVATAR_NAME_FONT_SIZE,
        ),
      );
      container.add(
        this.label(position.x, position.y, this.postLabel(member.post), MORNING.AVATAR_POST_FONT_SIZE),
      );
      container.add(
        this.label(
          position.x,
          position.y + 24,
          `速${member.speed} 艺${member.craft} 体${member.stamina} ${STAGE_DOTS[stage]}`,
          MORNING.AVATAR_STAT_FONT_SIZE,
        ),
      );
      // 成长阶段別の差分（S-28）: 台词は伙计別库（gdd 差分表 — P-02 成长可视化）。
      // plate の色は半透明蒙层（立绘の視認性を壊さない）— 色调は伙计別 ramp（STAGE_FX.TINTS_BY_STAFF）
      rect.setFillStyle(presentation.tint, GAMEPLAY.SPRITE_PLATE_ALPHA);
      container.add(
        this.label(
          position.x,
          position.y + MORNING.AVATAR_LINE_OFFSET_Y,
          this.textProvider(presentation.lineKey),
          MORNING.AVATAR_LINE_FONT_SIZE,
        ),
      );
      // 成长阶段別の差分（S-28）: 表情贴片（Graphics 描画 — 0=しょんぼり/1=真顔/2=笑顔。新規资产なし）
      if (avatarSprite !== null) {
        container.add(
          this.addExpressionPatch(
            position.x,
            position.y,
            MORNING.AVATAR_HEIGHT * GAMEPLAY.STAGE_SCALES[stage],
            stage,
          ),
        );
      }
      this.registerZone(
        GAMEPLAY_ZONES.STAFF_AVATAR(member.id),
        position,
        MORNING.AVATAR_WIDTH,
        MORNING.AVATAR_HEIGHT,
        {
          event: TAP_EVENTS.STAFF,
          priority: INPUT_PRIORITY.TABLE_ORDER,
          payload: { staffId: member.id },
        },
      );
    });

    const button = MORNING.OPEN_DOOR_BUTTON;
    const doorButton = this.scene.add
      .rectangle(button.x, button.y, MORNING.BUTTON_WIDTH, MORNING.BUTTON_HEIGHT, UI.PANEL_ACCENT, UI.PANEL_FILL_ALPHA)
      .setStrokeStyle(UI.PANEL_STROKE_WIDTH, UI.PANEL_STROKE);
    container.add(doorButton);
    container.add(
      this.label(button.x, button.y, this.textProvider(TEXT_KEYS.BUTTON_OPEN_DOOR), UI.PAUSE_BUTTON_FONT_SIZE),
    );
    this.registerZone(GAMEPLAY_ZONES.OPEN_DOOR, button, MORNING.BUTTON_WIDTH, MORNING.BUTTON_HEIGHT, {
      event: TAP_EVENTS.OPEN_DOOR,
      priority: INPUT_PRIORITY.TABLE_ORDER,
    });
    // 晨间引导超时 → 「开门营业」按钮脉冲（无强制时限 — S-03 acceptance）
    if (run.phaseElapsedMs > DAY_CYCLE.MORNING_GUIDE_TARGET_S * MS_PER_SECOND) {
      this.pulseTween = this.scene.tweens.add({
        targets: doorButton,
        scale: GAMEPLAY.GUIDE_PULSE_SCALE,
        duration: GAMEPLAY.GUIDE_PULSE_MS,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  private buildDay(run: RunState, container: Phaser.GameObjects.Container): void {
    container.add(addCoverBackground(this.scene, backgroundKeyForPhase('day')));
    // 黑烟/金光の出現条件（S-28 — gdd 差分表: 铁牛本人が掌勺のときのみ。表示導出のみ —
    // 正は Systems 层の RunState。値は保存せず rebuild ごとに導出し直す）
    this.dayHeadChefFx = headChefFx(run);

    // 日间唯一硬计时の進行バー（S-03: DAY_SERVICE_DURATION_S）
    container.add(
      this.scene.add
        .rectangle(GAME_WIDTH / 2, GAMEPLAY.PROGRESS_Y, GAMEPLAY.PROGRESS_WIDTH, GAMEPLAY.PROGRESS_HEIGHT, GAMEPLAY.PROGRESS_BG)
        .setOrigin(0.5, 0),
    );
    const progressFill = this.scene.add
      .rectangle(GAME_WIDTH / 2 - GAMEPLAY.PROGRESS_WIDTH / 2, GAMEPLAY.PROGRESS_Y, 0, GAMEPLAY.PROGRESS_HEIGHT, GAMEPLAY.PROGRESS_FILL)
      .setOrigin(0, 0);
    container.add(progressFill);
    this.progressFill = progressFill;

    // 柜台と出餐口（IMG 资产の無い施設プレート — 枠线付きパネル矩形で統一）
    container.add(
      this.scene.add.rectangle(GAME_LAYOUT.COUNTER.x, GAME_LAYOUT.COUNTER.y, GAMEPLAY.COUNTER_WIDTH, GAMEPLAY.COUNTER_HEIGHT, GAMEPLAY.SERVE_FILL).setStrokeStyle(UI.PANEL_STROKE_WIDTH, UI.PANEL_STROKE),
    );
    container.add(
      this.label(GAME_LAYOUT.COUNTER.x, GAME_LAYOUT.COUNTER.y, this.textProvider(TEXT_KEYS.LABEL_COUNTER), GAMEPLAY.LABEL_FONT_SIZE),
    );
    container.add(
      this.scene.add
        .rectangle(GAME_LAYOUT.SERVE_WINDOW.x, GAME_LAYOUT.SERVE_WINDOW.y, GAMEPLAY.SERVE_WINDOW_WIDTH, GAMEPLAY.SERVE_WINDOW_HEIGHT, GAMEPLAY.SERVE_FILL)
        .setStrokeStyle(UI.PANEL_STROKE_WIDTH, UI.PANEL_STROKE),
    );
    container.add(
      this.label(GAME_LAYOUT.SERVE_WINDOW.x, GAME_LAYOUT.SERVE_WINDOW.y - GAMEPLAY.SERVE_LABEL_OFFSET_Y, this.textProvider(TEXT_KEYS.LABEL_SERVE_WINDOW), GAMEPLAY.LABEL_FONT_SIZE),
    );

    // 出餐口に亮った菜（IMG-15～20 — 点击で上菜派遣。菜アイコンで客の注文と照合）
    run.kitchen.ready.forEach((dish, index) => {
      const x = GAME_LAYOUT.SERVE_WINDOW.x + GAMEPLAY.SERVE_RACK_X_OFFSET + (index % 3) * GAMEPLAY.SERVE_RACK_CELL;
      const y = GAME_LAYOUT.SERVE_WINDOW.y + GAMEPLAY.SERVE_RACK_Y_OFFSET + Math.floor(index / 3) * GAMEPLAY.SERVE_RACK_CELL;
      // 掌勺高阶の「出菜带金光」（S-28 gdd 差分表 — 菜の背後に金色パルス。程序化、新規资产なし）
      if (this.dayHeadChefFx.glow) {
        const glow = this.scene.add.circle(x, y, STAGE_FX.GLOW_RADIUS, STAGE_FX.GLOW_COLOR, STAGE_FX.GLOW_ALPHA);
        container.add(glow);
        this.rebuildTweens.push(
          this.scene.tweens.add({
            targets: glow,
            scale: STAGE_FX.GLOW_PULSE_SCALE,
            duration: STAGE_FX.GLOW_PULSE_MS,
            yoyo: true,
            repeat: -1,
          }),
        );
      }
      container.add(addScaledSprite(this.scene, dishSpriteKey(dish.dishId), x, y, SPRITE_DISPLAY.DISH_RACK_SIZE));
      this.registerZone(GAMEPLAY_ZONES.SERVE_DISH(dish.customerId), { x, y }, GAMEPLAY.SERVE_RACK_CELL, GAMEPLAY.SERVE_RACK_CELL, {
        event: TAP_EVENTS.SERVE_WINDOW,
        priority: INPUT_PRIORITY.SERVE_WINDOW,
        payload: { customerId: dish.customerId },
      });
    });

    // 6 桌（IMG-21 — 程序化摆放）
    for (let seat = 0; seat < CUSTOMER.SEATS; seat += 1) {
      const table = pointAt(GAME_LAYOUT.TABLES, seat);
      container.add(addScaledSprite(this.scene, ASSET_KEYS.images.tableRound, table.x, table.y, SPRITE_DISPLAY.TABLE_SIZE));
    }
    // 客人（IMG-11～13 — 桌に着席。id で 3 種を循环割当）
    for (const customer of run.customers) {
      const table = pointAt(GAME_LAYOUT.TABLES, customer.seat);
      container.add(
        addScaledSprite(
          this.scene,
          guestSpriteKey(customer.id),
          table.x,
          table.y + GAMEPLAY.GUEST_OFFSET_Y,
          SPRITE_DISPLAY.GUEST_HEIGHT,
        ),
      );
      // 耐心バー（待ちステージのみ — systems の patienceMs を每フレーム反映）
      const barBackground = this.scene.add
        .rectangle(table.x, table.y + GAMEPLAY.PATIENCE_BAR_OFFSET_Y, GAMEPLAY.PATIENCE_BAR_WIDTH, GAMEPLAY.PATIENCE_BAR_HEIGHT, GAMEPLAY.PATIENCE_BG)
        .setOrigin(0.5, 0);
      const barFill = this.scene.add
        .rectangle(table.x - GAMEPLAY.PATIENCE_BAR_WIDTH / 2, table.y + GAMEPLAY.PATIENCE_BAR_OFFSET_Y, GAMEPLAY.PATIENCE_BAR_WIDTH, GAMEPLAY.PATIENCE_BAR_HEIGHT, GAMEPLAY.PATIENCE_FILL)
        .setOrigin(0, 0);
      container.add(barBackground);
      container.add(barFill);
      this.patienceBars.set(customer.id, barFill);

      const bubbleY = table.y + GAMEPLAY.BUBBLE_OFFSET_Y;
      if (customer.stage === 'awaitingOrder') {
        this.addBubble(container, table.x, bubbleY, this.textProvider(TEXT_KEYS.BUBBLE_ORDER));
        this.registerZone(GAMEPLAY_ZONES.TABLE(customer.id), { x: table.x, y: bubbleY }, GAMEPLAY.BUBBLE_WIDTH, GAMEPLAY.BUBBLE_HEIGHT, {
          event: TAP_EVENTS.TABLE_ORDER,
          priority: INPUT_PRIORITY.TABLE_ORDER,
          payload: { customerId: customer.id },
        });
      } else if (customer.stage === 'awaitingDish' || customer.stage === 'serving') {
        // 注文菜（IMG-15～20）を气泡位置に表示 — 出餐口のアイコンと照合する
        container.add(addScaledSprite(this.scene, dishSpriteKey(customer.dishId), table.x, bubbleY, SPRITE_DISPLAY.DISH_BUBBLE_SIZE));
      } else if (customer.stage === 'awaitingPayment') {
        this.addBubble(container, table.x, bubbleY, this.textProvider(TEXT_KEYS.BUBBLE_PAYMENT));
        this.registerZone(GAMEPLAY_ZONES.PAYMENT(customer.id), { x: table.x, y: bubbleY }, GAMEPLAY.BUBBLE_WIDTH, GAMEPLAY.BUBBLE_HEIGHT, {
          event: TAP_EVENTS.PAYMENT_BUBBLE,
          priority: INPUT_PRIORITY.PAYMENT_BUBBLE,
          payload: { customerId: customer.id },
        });
      }
    }

    // 跑堂マーカー（每フレーム位置更新 — delta 驱动移动の可視化）。
    // 立绘（IMG-04～10）＋成长阶段別の差分（S-07 缩放 ＋ S-28 motion/残影 — stagePresentation）
    run.staff
      .filter((member) => member.post === 'waiter')
      .forEach((member, index) => {
        const stage = growthStage(member.speed + member.craft + member.stamina);
        const presentation = staffStagePresentation(member.id, stage);
        const marker = this.scene.add.container(
          GAME_LAYOUT.COUNTER.x + index * GAMEPLAY.WAITER_STAND_GAP,
          GAME_LAYOUT.COUNTER.y,
        );
        const spriteKey = staffSpriteKey(member.id);
        let sprite: Phaser.GameObjects.Image | null = null;
        if (spriteKey !== null) {
          sprite = addScaledSprite(this.scene, spriteKey, 0, 0, SPRITE_DISPLAY.WAITER_MARKER_HEIGHT);
          sprite.setScale(sprite.scale * GAMEPLAY.STAGE_SCALES[stage]);
          marker.add(sprite);
        }
        marker.add(
          this.label(0, GAMEPLAY.MARKER_NAME_OFFSET_Y, this.textProvider(member.nameKey), MORNING.AVATAR_STAT_FONT_SIZE),
        );
        container.add(marker);
        this.waiterMarkers.set(member.id, {
          container: marker,
          sprite,
          spriteKey,
          displayHeight: SPRITE_DISPLAY.WAITER_MARKER_HEIGHT * GAMEPLAY.STAGE_SCALES[stage],
          presentation,
          bobPhaseMs: 0,
          trailTimerMs: 0,
        });
      });
  }

  private buildNight(run: RunState, container: Phaser.GameObjects.Container): void {
    container.add(addCoverBackground(this.scene, backgroundKeyForPhase('night')));
    // 大敌（IMG-14 — 终战の夜のみ。夜パネルの左に立つ）
    if (run.finalBattleNight) {
      container.add(
        addScaledSprite(
          this.scene,
          ASSET_KEYS.images.rivalWarlord,
          GAMEPLAY.RIVAL_SPRITE.x,
          GAMEPLAY.RIVAL_SPRITE.y,
          SPRITE_DISPLAY.RIVAL_HEIGHT,
        ),
      );
    }
    container.add(
      this.scene.add
        .rectangle(NIGHT.PANEL_X, NIGHT.PANEL_Y, NIGHT.PANEL_WIDTH, NIGHT.PANEL_HEIGHT, UI.PANEL_FILL, UI.PANEL_FILL_ALPHA)
        .setStrokeStyle(UI.PANEL_STROKE_WIDTH, UI.PANEL_STROKE),
    );
    container.add(
      this.label(NIGHT.PANEL_X, NIGHT.PANEL_Y + NIGHT.TITLE_OFFSET_Y, this.textProvider(TEXT_KEYS.NIGHT_TITLE), NIGHT.TITLE_FONT_SIZE),
    );

    if (run.nightStage === 'summary') {
      const lines: ReadonlyArray<readonly [string, string]> = [
        [TEXT_KEYS.SUMMARY_INCOME, `+${run.daySummary.income}`],
        [TEXT_KEYS.SUMMARY_REP_NET, `${run.daySummary.reputationNet >= 0 ? '+' : ''}${run.daySummary.reputationNet}`],
        [TEXT_KEYS.SUMMARY_SERVED, String(run.daySummary.served)],
        [TEXT_KEYS.SUMMARY_FAILED, String(run.daySummary.failed)],
        [TEXT_KEYS.SUMMARY_WAGE, `-${run.daySummary.wage}`],
      ];
      lines.forEach(([key, value], index) => {
        const y = NIGHT.PANEL_Y + NIGHT.SUMMARY_LINE_START_OFFSET_Y + index * NIGHT.SUMMARY_LINE_GAP;
        container.add(this.label(NIGHT.PANEL_X - 180, y, this.textProvider(key), NIGHT.SUMMARY_FONT_SIZE));
        container.add(this.label(NIGHT.PANEL_X + 180, y, value, NIGHT.SUMMARY_FONT_SIZE));
      });

      const drawButton = { x: NIGHT.PANEL_X, y: NIGHT.PANEL_Y + NIGHT.DRAW_BUTTON_OFFSET_Y };
      container.add(
        this.scene.add.rectangle(drawButton.x, drawButton.y, MORNING.BUTTON_WIDTH, MORNING.BUTTON_HEIGHT, UI.PANEL_ACCENT, UI.PANEL_FILL_ALPHA).setStrokeStyle(UI.PANEL_STROKE_WIDTH, UI.PANEL_STROKE),
      );
      container.add(
        this.label(drawButton.x, drawButton.y, this.textProvider(TEXT_KEYS.BUTTON_DRAW_CARD), UI.PAUSE_BUTTON_FONT_SIZE),
      );
      this.registerZone(GAMEPLAY_ZONES.DRAW_CARD, drawButton, MORNING.BUTTON_WIDTH, MORNING.BUTTON_HEIGHT, {
        event: TAP_EVENTS.EVENT_CARD_DRAW,
        priority: INPUT_PRIORITY.EVENT_CARD_OPTION,
      });
      if (run.finalBattleNight) {
        container.add(
          this.label(
            NIGHT.PANEL_X,
            NIGHT.PANEL_Y + NIGHT.FINAL_NOTICE_OFFSET_Y,
            this.textProvider(TEXT_KEYS.FINAL_BATTLE_NOTICE),
            NIGHT.NOTICE_FONT_SIZE,
            UI.HUD_FLASH_UP_COLOR,
          ),
        );
      }
      return;
    }

    if (run.nightStage === 'card' && run.drawnCard !== null) {
      // 事件卡框（IMG-25 — 无文字装飾。選択肢と题字を框内に重ねる）
      container.add(
        addScaledSprite(
          this.scene,
          ASSET_KEYS.images.eventCardFrame,
          NIGHT.PANEL_X,
          NIGHT.PANEL_Y,
          SPRITE_DISPLAY.EVENT_CARD_HEIGHT,
        ),
      );
      container.add(
        this.label(
          NIGHT.PANEL_X,
          NIGHT.PANEL_Y + NIGHT.CARD_TITLE_OFFSET_Y,
          this.textProvider(TEXT_KEYS.CARD_TITLE_LABEL),
          NIGHT.TITLE_FONT_SIZE,
        ),
      );
      const card = this.cardById(run.drawnCard.cardId);
      if (card === undefined) {
        return;
      }
      card.options.forEach((option, index) => {
        const y = NIGHT.PANEL_Y + NIGHT.OPTION_START_OFFSET_Y + index * NIGHT.OPTION_GAP;
        container.add(
          this.scene.add.rectangle(NIGHT.PANEL_X, y, NIGHT.OPTION_WIDTH, NIGHT.OPTION_HEIGHT, UI.PANEL_ACCENT, UI.PANEL_FILL_ALPHA).setStrokeStyle(UI.PANEL_STROKE_WIDTH, UI.PANEL_STROKE),
        );
        container.add(
          this.scene.add
            .text(NIGHT.PANEL_X, y, this.textProvider(option.textKey), {
              fontFamily: UI.HUD_FONT_FAMILY,
              resolution: UI.TEXT_RESOLUTION,
              fontSize: NIGHT.OPTION_FONT_SIZE,
              color: UI.HUD_TEXT_COLOR,
              stroke: UI.HUD_STROKE_COLOR,
              strokeThickness: UI.HUD_STROKE_WIDTH,
              wordWrap: { width: NIGHT.OPTION_WIDTH - 32 },
            })
            .setOrigin(0.5),
        );
        this.registerZone(GAMEPLAY_ZONES.CARD_OPTION(index), { x: NIGHT.PANEL_X, y }, NIGHT.OPTION_WIDTH, NIGHT.OPTION_HEIGHT, {
          event: TAP_EVENTS.EVENT_CARD_OPTION,
          priority: INPUT_PRIORITY.EVENT_CARD_OPTION,
          payload: { optionIndex: index },
        });
      });
      return;
    }

    if (run.nightStage === 'result' && run.drawnCard !== null) {
      container.add(
        this.scene.add
          .text(NIGHT.PANEL_X, NIGHT.PANEL_Y + NIGHT.RESULT_TEXT_OFFSET_Y, this.textProvider(run.drawnCard.resultTextKey ?? TEXT_KEYS.CARD_RESULT_LABEL), {
            fontFamily: UI.HUD_FONT_FAMILY,
            resolution: UI.TEXT_RESOLUTION,
            fontSize: NIGHT.RESULT_FONT_SIZE,
            color: UI.HUD_TEXT_COLOR,
            stroke: UI.HUD_STROKE_COLOR,
            strokeThickness: UI.HUD_STROKE_WIDTH,
            wordWrap: { width: NIGHT.RESULT_WRAP_WIDTH },
          })
          .setOrigin(0.5),
      );
      const daybreakButton = { x: NIGHT.PANEL_X, y: NIGHT.PANEL_Y + NIGHT.DAYBREAK_BUTTON_OFFSET_Y };
      const labelKey = run.finalBattleNight ? TEXT_KEYS.BUTTON_FIGHT : TEXT_KEYS.BUTTON_DAYBREAK;
      container.add(
        this.scene.add.rectangle(daybreakButton.x, daybreakButton.y, MORNING.BUTTON_WIDTH, MORNING.BUTTON_HEIGHT, UI.PANEL_ACCENT, UI.PANEL_FILL_ALPHA).setStrokeStyle(UI.PANEL_STROKE_WIDTH, UI.PANEL_STROKE),
      );
      container.add(
        this.label(daybreakButton.x, daybreakButton.y, this.textProvider(labelKey), UI.PAUSE_BUTTON_FONT_SIZE),
      );
      this.registerZone(GAMEPLAY_ZONES.DAYBREAK, daybreakButton, MORNING.BUTTON_WIDTH, MORNING.BUTTON_HEIGHT, {
        event: TAP_EVENTS.DAYBREAK,
        priority: INPUT_PRIORITY.EVENT_CARD_OPTION,
      });
    }

    // 终战開戦前選択（S-19 — 第 20 日夜「迎战」後。表示値は systems/finalBattle から導出）
    if (run.nightStage === 'battle' && run.finalBattle !== null) {
      this.buildBattlePanel(run, container);
    }
  }

  /** 终战開戦前パネル（S-19。战力/援助可否は systems 導出値のみ — UI 側で状態を持有しない） */
  private buildBattlePanel(run: RunState, container: Phaser.GameObjects.Container): void {
    container.add(
      this.label(NIGHT.PANEL_X, NIGHT.PANEL_Y + NIGHT.CARD_TITLE_OFFSET_Y, this.textProvider(TEXT_KEYS.BATTLE_TITLE), NIGHT.TITLE_FONT_SIZE),
    );
    // 战力表示（player = staffPowerTotal ＋援助加成 / enemy = config.ENEMY_POWER）
    const powerLines: ReadonlyArray<readonly [string, string]> = [
      [TEXT_KEYS.BATTLE_PLAYER_POWER, String(playerPowerOf(run))],
      [TEXT_KEYS.BATTLE_ENEMY_POWER, String(ENEMY_POWER)],
    ];
    powerLines.forEach(([key, value], index) => {
      const y = NIGHT.PANEL_Y + BATTLE_UI.POWER_LINE_START_OFFSET_Y + index * BATTLE_UI.POWER_LINE_GAP;
      container.add(this.label(NIGHT.PANEL_X + BATTLE_UI.POWER_LABEL_OFFSET_X, y, this.textProvider(key), BATTLE_UI.POWER_FONT_SIZE));
      container.add(this.label(NIGHT.PANEL_X + BATTLE_UI.POWER_VALUE_OFFSET_X, y, value, BATTLE_UI.POWER_FONT_SIZE));
    });
    // 援助の费用/战力（数值は config 直参照 — 文案は i18n key。単位を含まない数式表示）
    container.add(
      this.label(
        NIGHT.PANEL_X,
        NIGHT.PANEL_Y + BATTLE_UI.AID_INFO_OFFSET_Y,
        `${this.textProvider(TEXT_KEYS.BATTLE_AID_INFO)}  -${BATTLE_AID_COST} / +${BATTLE_AID_POWER}`,
        BATTLE_UI.AID_INFO_FONT_SIZE,
      ),
    );

    // 「雇镖师援助」— 银子不足/雇入济みは判定区ごと未登録＝点击不発＋不活性表示（S-19 acceptance）
    const aidEnabled = canHireAid(run);
    const aidButton = { x: NIGHT.PANEL_X, y: NIGHT.PANEL_Y + BATTLE_UI.AID_BUTTON_OFFSET_Y };
    container.add(
      this.scene.add
        .rectangle(aidButton.x, aidButton.y, MORNING.BUTTON_WIDTH, MORNING.BUTTON_HEIGHT, UI.PANEL_ACCENT, UI.PANEL_FILL_ALPHA)
        .setStrokeStyle(UI.PANEL_STROKE_WIDTH, UI.PANEL_STROKE)
        .setAlpha(aidEnabled ? 1 : BATTLE_UI.DISABLED_ALPHA),
    );
    container.add(
      this.label(aidButton.x, aidButton.y, this.textProvider(TEXT_KEYS.BUTTON_AID_HIRE), UI.PAUSE_BUTTON_FONT_SIZE).setAlpha(
        aidEnabled ? 1 : BATTLE_UI.DISABLED_ALPHA,
      ),
    );
    if (aidEnabled) {
      this.registerZone(GAMEPLAY_ZONES.AID_HIRE, aidButton, MORNING.BUTTON_WIDTH, MORNING.BUTTON_HEIGHT, {
        event: TAP_EVENTS.AID_HIRE,
        priority: INPUT_PRIORITY.EVENT_CARD_OPTION,
      });
    }

    // 「开战」→ 3 回合自动对撞（systems/finalBattle.fight — 胜败で Result へ自动迁移）
    const fightButton = { x: NIGHT.PANEL_X, y: NIGHT.PANEL_Y + BATTLE_UI.FIGHT_BUTTON_OFFSET_Y };
    container.add(
      this.scene.add
        .rectangle(fightButton.x, fightButton.y, MORNING.BUTTON_WIDTH, MORNING.BUTTON_HEIGHT, UI.PANEL_ACCENT, UI.PANEL_FILL_ALPHA)
        .setStrokeStyle(UI.PANEL_STROKE_WIDTH, UI.PANEL_STROKE),
    );
    container.add(
      this.label(fightButton.x, fightButton.y, this.textProvider(TEXT_KEYS.BUTTON_FIGHT_START), UI.PAUSE_BUTTON_FONT_SIZE),
    );
    this.registerZone(GAMEPLAY_ZONES.FIGHT_CONFIRM, fightButton, MORNING.BUTTON_WIDTH, MORNING.BUTTON_HEIGHT, {
      event: TAP_EVENTS.FIGHT_CONFIRM,
      priority: INPUT_PRIORITY.EVENT_CARD_OPTION,
    });
  }

  // ==== 每フレームの動的更新 ====

  private updateDynamic(run: RunState, delta: number): void {
    // 耐心バー（待ちステージの客人のみ表示）
    for (const [customerId, bar] of this.patienceBars) {
      const customer = run.customers.find((candidate) => candidate.id === customerId);
      if (customer === undefined || !(customer.stage === 'awaitingOrder' || customer.stage === 'awaitingDish')) {
        bar.setVisible(false);
        continue;
      }
      const ratio = Math.max(0, Math.min(1, customer.patienceMs / customer.maxPatienceMs));
      bar.setVisible(true);
      bar.width = GAMEPLAY.PATIENCE_BAR_WIDTH * ratio;
      bar.setSize(bar.width, GAMEPLAY.PATIENCE_BAR_HEIGHT);
    }
    // 日间進行バー
    if (this.progressFill !== null) {
      const ratio = Math.min(1, run.phaseElapsedMs / (DAY_CYCLE.DAY_SERVICE_DURATION_S * MS_PER_SECOND));
      this.progressFill.width = GAMEPLAY.PROGRESS_WIDTH * ratio;
      this.progressFill.setSize(this.progressFill.width, GAMEPLAY.PROGRESS_HEIGHT);
    }
    // 制菜冒黑烟（S-28 gdd 差分表）: 制菜 ticket 進行中 × 铁牛（低位）が掌勺 —
    // delta 驱动の間隔 emission（フレーム率に依存しない）
    if (run.phase === 'day' && this.dayHeadChefFx.smoke && run.kitchen.tickets.length > 0) {
      this.smokeTimerMs += delta;
      if (this.smokeTimerMs >= STAGE_FX.SMOKE_INTERVAL_MS) {
        this.smokeTimerMs -= STAGE_FX.SMOKE_INTERVAL_MS;
        this.emitSmokePuff();
      }
    } else {
      this.smokeTimerMs = 0;
    }
    // 跑堂移动（move 種別のみ补间。动作中は対象位置に静止）＋成长阶段別の移動演出（S-28）
    for (const [staffId, marker] of this.waiterMarkers) {
      const action = run.waiterActions.find((candidate) => candidate.staffId === staffId);
      if (action === undefined) {
        const index = run.staff.findIndex((member) => member.id === staffId);
        marker.container.setPosition(GAME_LAYOUT.COUNTER.x + index * GAMEPLAY.WAITER_STAND_GAP, GAME_LAYOUT.COUNTER.y);
        this.updateMarkerMotion(marker, 0, false);
        continue;
      }
      const target =
        action.kind === 'moveToWindow'
          ? GAME_LAYOUT.SERVE_WINDOW
          : pointAt(GAME_LAYOUT.TABLES, action.seat);
      const moving =
        action.kind === 'moveToOrder' || action.kind === 'moveToWindow' || action.kind === 'moveToCollect';
      if (!moving) {
        marker.container.setPosition(target.x, target.y);
        this.updateMarkerMotion(marker, 0, false);
        continue;
      }
      const progress = action.totalMs > 0 ? 1 - action.remainingMs / action.totalMs : 1;
      const x = GAME_LAYOUT.COUNTER.x + (target.x - GAME_LAYOUT.COUNTER.x) * progress;
      const y = GAME_LAYOUT.COUNTER.y + (target.y - GAME_LAYOUT.COUNTER.y) * progress;
      marker.container.setPosition(x, y);
      this.updateMarkerMotion(marker, delta, true);
    }
  }

  /**
   * 跑堂の成长阶段別移動演出（S-28 — gdd 差分表の速度/动作の可視化）。
   * 位置の正は Systems 側（waiterActions）で、ここは delta で進める表示演出のみ。
   */
  private updateMarkerMotion(marker: WaiterMarkerView, delta: number, moving: boolean): void {
    marker.bobPhaseMs = moving ? marker.bobPhaseMs + delta : 0;
    if (marker.sprite !== null) {
      const phaseRad = (marker.bobPhaseMs / MS_PER_SECOND) * Math.PI * 2 * marker.presentation.bobFreqHz;
      marker.sprite.y = moving
        ? -Math.abs(Math.sin(phaseRad)) * marker.presentation.bobAmpPx
        : 0;
      marker.sprite.setRotation(moving ? Math.sin(phaseRad) * marker.presentation.waddleRad : 0);
    }
    // 阿福高阶の「残影」（移動中のみ等間隔で立绘 ghost を残す — 程序化、テクスチャ再利用）
    if (moving && marker.presentation.trail && marker.spriteKey !== null) {
      marker.trailTimerMs += delta;
      if (marker.trailTimerMs >= STAGE_FX.TRAIL_INTERVAL_MS) {
        marker.trailTimerMs -= STAGE_FX.TRAIL_INTERVAL_MS;
        this.spawnTrailGhost(marker);
      }
    } else {
      marker.trailTimerMs = 0;
    }
  }

  /** 残影 ghost（S-28 — 既存立绘テクスチャの再利用。fade 後に破棄） */
  private spawnTrailGhost(marker: WaiterMarkerView): void {
    if (this.container === null || marker.spriteKey === null) {
      return;
    }
    const ghost = addScaledSprite(this.scene, marker.spriteKey, marker.container.x, marker.container.y, marker.displayHeight);
    ghost.setAlpha(STAGE_FX.TRAIL_ALPHA);
    this.container.add(ghost);
    // fade tween も rebuild 寿命管理に登録（CR-CODE iter1 finding 4 — rebuild/destroy 中の
    // 描画対象破棄と tween 残置の二重管理を防ぐ。remove されれば onComplete は発火しないが
    // container.destroy(true) が子を破棄するため破棄漏れはない）
    this.rebuildTweens.push(
      this.scene.tweens.add({
        targets: ghost,
        alpha: 0,
        duration: STAGE_FX.TRAIL_FADE_MS,
        onComplete: (): void => {
          ghost.destroy();
        },
      }),
    );
  }

  /** 制菜黑烟（S-28 — 柜台上端から立ち上る煙パフ。Graphics 円で程序化） */
  private emitSmokePuff(): void {
    if (this.container === null) {
      return;
    }
    const driftX = (Math.random() * 2 - 1) * STAGE_FX.SMOKE_DRIFT_X;
    const puff = this.scene.add.circle(
      GAME_LAYOUT.COUNTER.x + driftX,
      GAME_LAYOUT.COUNTER.y - GAMEPLAY.COUNTER_HEIGHT / 2,
      STAGE_FX.SMOKE_RADIUS,
      STAGE_FX.SMOKE_COLOR,
      STAGE_FX.SMOKE_ALPHA,
    );
    this.container.add(puff);
    // fade tween も rebuild 寿命管理に登録（CR-CODE iter1 finding 4 — spawnTrailGhost と同型）
    this.rebuildTweens.push(
      this.scene.tweens.add({
        targets: puff,
        y: puff.y - STAGE_FX.SMOKE_RISE_PX,
        scale: STAGE_FX.SMOKE_END_SCALE,
        alpha: 0,
        duration: STAGE_FX.SMOKE_FADE_MS,
        onComplete: (): void => {
          puff.destroy();
        },
      }),
    );
  }

  // ==== 共通ヘルパ ====

  private postLabel(post: RunState['staff'][number]['post']): string {
    const definition = POST_DEFINITIONS.find((candidate) => candidate.id === post);
    const key = definition?.labelKey ?? TEXT_KEYS.POST_STANDBY;
    return this.textProvider(key);
  }

  private cardById(cardId: number) {
    return EVENT_CARD_POOL.find((card) => card.id === cardId);
  }

  private addBubble(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    text: string,
  ): void {
    container.add(
      this.scene.add.rectangle(x, y, GAMEPLAY.BUBBLE_WIDTH, GAMEPLAY.BUBBLE_HEIGHT, GAMEPLAY.BUBBLE_FILL, 0.96).setStrokeStyle(UI.PANEL_ACCENT_WIDTH, UI.PANEL_ACCENT),
    );
    container.add(this.label(x, y, text, GAMEPLAY.DISH_FONT_SIZE, GAMEPLAY.BUBBLE_TEXT_COLOR));
  }

  private label(
    x: number,
    y: number,
    text: string,
    fontSize: string,
    color: string = UI.HUD_TEXT_COLOR,
  ): Phaser.GameObjects.Text {
    return this.scene.add
      .text(x, y, text, {
        fontFamily: UI.HUD_FONT_FAMILY,
        resolution: UI.TEXT_RESOLUTION,
        fontSize,
        color,
        stroke: UI.HUD_STROKE_COLOR,
        strokeThickness: UI.HUD_STROKE_WIDTH,
      })
      .setOrigin(0.5);
  }

  /**
   * 表情贴片（S-28 — Graphics 描画のみの程序化差分。眼 2 点＋口弧で 3 段を表現）。
   * gdd 差分表「色调/表情贴片/缩放」の表情贴片。位置は立绘表示高さの上半分（顔域）に固定 —
   * 立绘ごとの顔位置の個差は HEAD_FROM_TOP_RATIO で吸収する（pixel 完全一致は狙わない）。
   * CR-CODE iter1 finding 3: 顔域を名前ラベル帯（AVATAR_NAME_OFFSET_Y）より上に置く —
   * 贴片は名前ラベルより後に add されるため、重なると文字に乗ってしまう。
   */
  private addExpressionPatch(
    x: number,
    centerY: number,
    displayHeight: number,
    stage: 0 | 1 | 2,
  ): Phaser.GameObjects.Graphics {
    const fx = STAGE_FX.EXPRESSION;
    const headY = centerY - displayHeight * (0.5 - fx.HEAD_FROM_TOP_RATIO);
    const patch = this.scene.add.graphics();
    patch.fillStyle(fx.COLOR, 1);
    patch.fillCircle(x - fx.EYE_DX, headY, fx.EYE_RADIUS);
    patch.fillCircle(x + fx.EYE_DX, headY, fx.EYE_RADIUS);
    patch.lineStyle(fx.LINE_WIDTH, fx.COLOR, 1);
    patch.beginPath();
    if (stage === 2) {
      // 笑顔 — 下向きの弧（口角が上がる）
      patch.arc(x, headY + fx.MOUTH_SMILE_DY, fx.MOUTH_RADIUS, fx.MOUTH_ARC_INSET, Math.PI - fx.MOUTH_ARC_INSET);
    } else if (stage === 0) {
      // しょんぼり — 上向きの弧（口角が下がる）
      patch.arc(x, headY + fx.MOUTH_FROWN_DY, fx.MOUTH_RADIUS, Math.PI + fx.MOUTH_ARC_INSET, Math.PI * 2 - fx.MOUTH_ARC_INSET);
    } else {
      // 真顔 — 直线
      patch.moveTo(x - fx.MOUTH_RADIUS, headY + fx.MOUTH_SMILE_DY);
      patch.lineTo(x + fx.MOUTH_RADIUS, headY + fx.MOUTH_SMILE_DY);
    }
    patch.strokePath();
    return patch;
  }

  private registerZone(
    zoneId: string,
    center: { readonly x: number; readonly y: number },
    width: number,
    height: number,
    options: { readonly event: TapEventName; readonly priority: number; readonly payload?: Readonly<Record<string, number | string>> },
  ): void {
    this.router.registerZone({
      id: zoneId,
      bounds: { x: center.x - width / 2, y: center.y - height / 2, width, height },
      priority: options.priority,
      event: options.event,
      payload: options.payload,
    });
    this.zoneIds.add(zoneId);
  }

  private unregisterZones(): void {
    for (const zoneId of this.zoneIds) {
      this.router.unregisterZone(zoneId);
    }
    this.zoneIds.clear();
  }
}
