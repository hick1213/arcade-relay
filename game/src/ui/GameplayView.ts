/**
 * GameplayView — GameScene の玩法表示（S-02/S-03/S-05/S-06/S-09 の視覚化）。
 *
 * - 显示值は全部 Systems 层の RunState から導出（ui-code 规范: 双重管理禁止）。
 *   本クラスは「受けて描く」だけ Navystate を持有しない（dynamic 表示用の描画物参照のみ）。
 * - 構造（相位/客人構成/夜段階/選択岗位…）が変わった時だけ再構築し、
 *   每フレーム更新は waiter 移動・耐心バー・日间進行バーのみ（GC 負荷を抑える）。
 * - 点击判定は InputRouter へ登録（優先度仲裁は input 层 — conventions 规则 7）。
 * - 占位色块＋程序化 tint（IMG 资产未生成 — S-02 acceptance / conventions 规则 6）。
 */
import Phaser from 'phaser';
import {
  AMBITION_UI,
  CUSTOMER,
  DAY_CYCLE,
  GAMEPLAY,
  GAMEPLAY_ZONES,
  GAME_HEIGHT,
  GAME_LAYOUT,
  GAME_WIDTH,
  INPUT_PRIORITY,
  MORNING,
  MS_PER_SECOND,
  NIGHT,
  POST_CAPACITY,
  UI,
} from '../config';
import type { InputRouter } from '../systems/input/InputRouter';
import { AMBITION_PACKS } from '../systems/ambition';
import { EVENT_CARD_POOL } from '../systems/eventCardData';
import { getLanguage } from '../systems/i18n';
import { growthStage } from '../systems/training';
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

/** 成长阶段 → 台词 key（S-07: 台词按成长阶段切换。文案は systems/i18n 言語表） */
const STAFF_LINE_KEYS = [
  TEXT_KEYS.STAFF_LINE_STAGE_1,
  TEXT_KEYS.STAFF_LINE_STAGE_2,
  TEXT_KEYS.STAFF_LINE_STAGE_3,
] as const;

/** 配列インデックス参照の undefined 抑止（index は常に範囲内 — 布局定数は固定長） */
function pointAt(list: readonly { readonly x: number; readonly y: number }[], index: number) {
  return list[index] as { readonly x: number; readonly y: number };
}

export class GameplayView {
  private container: Phaser.GameObjects.Container | null = null;
  private structuralKey = '';
  private readonly zoneIds = new Set<string>();
  private readonly patienceBars = new Map<number, Phaser.GameObjects.Rectangle>();
  private readonly waiterMarkers = new Map<string, Phaser.GameObjects.Container>();
  private progressFill: Phaser.GameObjects.Rectangle | null = null;
  private pulseTween: Phaser.Tweens.Tween | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly textProvider: TextProvider,
    private readonly router: InputRouter,
  ) {}

  render(run: RunState): void {
    const key = this.buildStructuralKey(run);
    if (key !== this.structuralKey || this.container === null) {
      this.rebuild(run);
      this.structuralKey = key;
    }
    this.updateDynamic(run);
  }

  destroy(): void {
    this.unregisterZones();
    this.container?.destroy(true);
    this.container = null;
    this.pulseTween?.remove();
    this.pulseTween = null;
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
    this.pulseTween?.remove();
    this.pulseTween = null;
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
    container.add(
      this.scene.add
        .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, GAMEPLAY.BG_MORNING)
        .setOrigin(0, 0),
    );
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
    container.add(
      this.scene.add
        .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, GAMEPLAY.BG_MORNING)
        .setOrigin(0, 0),
    );
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
      const rect = this.scene.add
        .rectangle(position.x, position.y, MORNING.AVATAR_WIDTH, MORNING.AVATAR_HEIGHT, GAMEPLAY.STAFF_FILL)
        .setStrokeStyle(UI.PANEL_STROKE_WIDTH, UI.PANEL_STROKE);
      container.add(rect);
      container.add(
        this.label(position.x, position.y - 26, this.textProvider(member.nameKey), MORNING.AVATAR_NAME_FONT_SIZE),
      );
      container.add(
        this.label(position.x, position.y, this.postLabel(member.post), MORNING.AVATAR_POST_FONT_SIZE),
      );
      const total = member.speed + member.craft + member.stamina;
      container.add(
        this.label(
          position.x,
          position.y + 24,
          `速${member.speed} 艺${member.craft} 体${member.stamina} ${STAGE_DOTS[growthStage(total)]}`,
          MORNING.AVATAR_STAT_FONT_SIZE,
        ),
      );
      // 成长阶段別の差分（S-07）: 色调（阶段で明るくなる tint）＋阶段別台词 1 行
      const stage = growthStage(total);
      rect.setFillStyle(GAMEPLAY.STAGE_TINTS[stage]);
      container.add(
        this.label(
          position.x,
          position.y + MORNING.AVATAR_LINE_OFFSET_Y,
          this.textProvider(STAFF_LINE_KEYS[stage]),
          MORNING.AVATAR_LINE_FONT_SIZE,
        ),
      );
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
    container.add(
      this.scene.add
        .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, GAMEPLAY.BG_DAY)
        .setOrigin(0, 0),
    );

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

    // 柜台と出餐口
    container.add(
      this.scene.add.rectangle(GAME_LAYOUT.COUNTER.x, GAME_LAYOUT.COUNTER.y, 160, 48, GAMEPLAY.SERVE_FILL).setStrokeStyle(UI.PANEL_STROKE_WIDTH, UI.PANEL_STROKE),
    );
    container.add(
      this.label(GAME_LAYOUT.COUNTER.x, GAME_LAYOUT.COUNTER.y, this.textProvider(TEXT_KEYS.LABEL_COUNTER), GAMEPLAY.LABEL_FONT_SIZE),
    );
    container.add(
      this.scene.add
        .rectangle(GAME_LAYOUT.SERVE_WINDOW.x, GAME_LAYOUT.SERVE_WINDOW.y, 120, 56, GAMEPLAY.SERVE_FILL)
        .setStrokeStyle(UI.PANEL_STROKE_WIDTH, UI.PANEL_STROKE),
    );
    container.add(
      this.label(GAME_LAYOUT.SERVE_WINDOW.x, GAME_LAYOUT.SERVE_WINDOW.y - 40, this.textProvider(TEXT_KEYS.LABEL_SERVE_WINDOW), GAMEPLAY.LABEL_FONT_SIZE),
    );

    // 出餐口に亮った菜（点击で上菜派遣）
    run.kitchen.ready.forEach((dish, index) => {
      const x = GAME_LAYOUT.SERVE_WINDOW.x - 40 + (index % 3) * 40;
      const y = GAME_LAYOUT.SERVE_WINDOW.y + 40 + Math.floor(index / 3) * 40;
      container.add(
        this.scene.add.rectangle(x, y, 36, 36, GAMEPLAY.CUSTOMER_FILL).setStrokeStyle(UI.PANEL_ACCENT_WIDTH, UI.PANEL_ACCENT),
      );
      container.add(this.label(x, y, String(dish.dishId), GAMEPLAY.DISH_FONT_SIZE, GAMEPLAY.BUBBLE_TEXT_COLOR));
      this.registerZone(GAMEPLAY_ZONES.SERVE_DISH(dish.customerId), { x, y }, 48, 48, {
        event: TAP_EVENTS.SERVE_WINDOW,
        priority: INPUT_PRIORITY.SERVE_WINDOW,
        payload: { customerId: dish.customerId },
      });
    });

    // 6 桌と客人
    for (let seat = 0; seat < CUSTOMER.SEATS; seat += 1) {
      const table = pointAt(GAME_LAYOUT.TABLES, seat);
      container.add(
        this.scene.add.rectangle(table.x, table.y, GAME_LAYOUT.TABLE_WIDTH, GAME_LAYOUT.TABLE_HEIGHT, GAMEPLAY.TABLE_FILL).setStrokeStyle(UI.PANEL_STROKE_WIDTH, GAMEPLAY.TABLE_STROKE),
      );
    }
    for (const customer of run.customers) {
      const table = pointAt(GAME_LAYOUT.TABLES, customer.seat);
      container.add(
        this.scene.add.circle(table.x, table.y, GAMEPLAY.MARKER_SIZE, GAMEPLAY.CUSTOMER_FILL).setStrokeStyle(UI.PANEL_ACCENT_WIDTH, UI.PANEL_ACCENT),
      );
      // 耐心バー（待ちステージのみ — systems の patienceMs を每フレーム反映）
      const barBackground = this.scene.add
        .rectangle(table.x, table.y + 56, GAMEPLAY.PATIENCE_BAR_WIDTH, GAMEPLAY.PATIENCE_BAR_HEIGHT, GAMEPLAY.PATIENCE_BG)
        .setOrigin(0.5, 0);
      const barFill = this.scene.add
        .rectangle(table.x - GAMEPLAY.PATIENCE_BAR_WIDTH / 2, table.y + 56, GAMEPLAY.PATIENCE_BAR_WIDTH, GAMEPLAY.PATIENCE_BAR_HEIGHT, GAMEPLAY.PATIENCE_FILL)
        .setOrigin(0, 0);
      container.add(barBackground);
      container.add(barFill);
      this.patienceBars.set(customer.id, barFill);

      if (customer.stage === 'awaitingOrder') {
        this.addBubble(container, table.x, table.y - 52, this.textProvider(TEXT_KEYS.BUBBLE_ORDER));
        this.registerZone(GAMEPLAY_ZONES.TABLE(customer.id), { x: table.x, y: table.y - 52 }, GAMEPLAY.BUBBLE_WIDTH, GAMEPLAY.BUBBLE_HEIGHT, {
          event: TAP_EVENTS.TABLE_ORDER,
          priority: INPUT_PRIORITY.TABLE_ORDER,
          payload: { customerId: customer.id },
        });
      } else if (customer.stage === 'awaitingDish' || customer.stage === 'serving') {
        this.addBubble(container, table.x, table.y - 52, String(customer.dishId));
      } else if (customer.stage === 'awaitingPayment') {
        this.addBubble(container, table.x, table.y - 52, this.textProvider(TEXT_KEYS.BUBBLE_PAYMENT));
        this.registerZone(GAMEPLAY_ZONES.PAYMENT(customer.id), { x: table.x, y: table.y - 52 }, GAMEPLAY.BUBBLE_WIDTH, GAMEPLAY.BUBBLE_HEIGHT, {
          event: TAP_EVENTS.PAYMENT_BUBBLE,
          priority: INPUT_PRIORITY.PAYMENT_BUBBLE,
          payload: { customerId: customer.id },
        });
      }
    }

    // 跑堂マーカー（每フレーム位置更新 — delta 驱动移动の可視化）。
    // 成长阶段別の程序化差分（S-07）: 色调＋缩放（立绘の見た目が成長で変わる）
    run.staff
      .filter((member) => member.post === 'waiter')
      .forEach((member, index) => {
        const stage = growthStage(member.speed + member.craft + member.stamina);
        const marker = this.scene.add.container(GAME_LAYOUT.COUNTER.x + index * 40, GAME_LAYOUT.COUNTER.y);
        marker.add(
          this.scene.add
            .rectangle(0, 0, GAMEPLAY.MARKER_SIZE, GAMEPLAY.MARKER_SIZE, GAMEPLAY.STAGE_TINTS[stage])
            .setStrokeStyle(UI.PANEL_ACCENT_WIDTH, UI.PANEL_ACCENT),
        );
        marker.add(this.label(0, 0, this.textProvider(member.nameKey), MORNING.AVATAR_STAT_FONT_SIZE));
        marker.setScale(GAMEPLAY.STAGE_SCALES[stage]);
        container.add(marker);
        this.waiterMarkers.set(member.id, marker);
      });
  }

  private buildNight(run: RunState, container: Phaser.GameObjects.Container): void {
    container.add(
      this.scene.add
        .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, GAMEPLAY.BG_NIGHT)
        .setOrigin(0, 0),
    );
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
  }

  // ==== 每フレームの動的更新 ====

  private updateDynamic(run: RunState): void {
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
    // 跑堂移动（move 種別のみ补间。动作中は対象位置に静止）
    for (const [staffId, marker] of this.waiterMarkers) {
      const action = run.waiterActions.find((candidate) => candidate.staffId === staffId);
      if (action === undefined) {
        const index = run.staff.findIndex((member) => member.id === staffId);
        marker.setPosition(GAME_LAYOUT.COUNTER.x + index * 40, GAME_LAYOUT.COUNTER.y);
        continue;
      }
      const target =
        action.kind === 'moveToWindow'
          ? GAME_LAYOUT.SERVE_WINDOW
          : pointAt(GAME_LAYOUT.TABLES, action.seat);
      if (action.kind !== 'moveToOrder' && action.kind !== 'moveToWindow' && action.kind !== 'moveToCollect') {
        marker.setPosition(target.x, target.y);
        continue;
      }
      const progress = action.totalMs > 0 ? 1 - action.remainingMs / action.totalMs : 1;
      const x = GAME_LAYOUT.COUNTER.x + (target.x - GAME_LAYOUT.COUNTER.x) * progress;
      const y = GAME_LAYOUT.COUNTER.y + (target.y - GAME_LAYOUT.COUNTER.y) * progress;
      marker.setPosition(x, y);
    }
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
