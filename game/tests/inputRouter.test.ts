/**
 * inputRouter.test.ts — S-01 点击输入抽象化模块的验收测试。
 *
 * - 2 个判定区同时重叠时按优先级仲裁: 只触发高优先级一方的语义化事件（acceptance 本体）。
 * - 全部交互为单次点击即触发（handlePointerDown — pointerup/双击/长按不依赖）。
 * - 判定区不足 BUTTON_MIN_SIZE_PX 时扩张到最小边长。
 * - InputRouter は systems/input（Phaser 非依赖 — import を持たない纯モジュール）なので
 *   Node 环境でそのままテスト可能（acceptance「systems/input/ 不 import Phaser」の担保）。
 *
 * 运行: cd game && npm test（vitest run）
 */
import { describe, expect, it, vi } from 'vitest';
import { BUTTON_MIN_SIZE_PX, INPUT_PRIORITY } from '../src/config';
import { clampTapBounds, InputRouter, pointInRect } from '../src/systems/input/InputRouter';
import { TAP_EVENTS, type TapHit } from '../src/types';

const makeRect = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

describe('S-01 InputRouter — 优先级仲裁', () => {
  it('同时重叠的 2 判定区は高优先级一方のイベントのみ発火する', () => {
    const router = new InputRouter();
    const lowHandler = vi.fn();
    const highHandler = vi.fn();

    // 桌位（低优先级）とその上に重なる出餐口判定（高优先级）— 同一点を両方が命中させる
    router.registerZone({
      id: 'table',
      bounds: makeRect(0, 0, 120, 84),
      priority: INPUT_PRIORITY.TABLE_ORDER,
      event: TAP_EVENTS.TABLE_ORDER,
      payload: { customerId: 1 },
    });
    router.registerZone({
      id: 'serve',
      bounds: makeRect(0, 0, 120, 84),
      priority: INPUT_PRIORITY.SERVE_WINDOW,
      event: TAP_EVENTS.SERVE_WINDOW,
      payload: { customerId: 1 },
    });
    router.on(TAP_EVENTS.TABLE_ORDER, lowHandler);
    router.on(TAP_EVENTS.SERVE_WINDOW, highHandler);

    const dispatched = router.handlePointerDown(60, 40);

    expect(dispatched).toBe(true);
    expect(highHandler).toHaveBeenCalledTimes(1);
    const highHit = highHandler.mock.calls[0]?.[0] as TapHit | undefined;
    expect(highHit).toBeDefined();
    expect(highHit).toMatchObject({
      zoneId: 'serve',
      event: TAP_EVENTS.SERVE_WINDOW,
    });
    // 低优先级は発火しない（重複発火 = 优先仲裁の违反）
    expect(lowHandler).not.toHaveBeenCalled();
  });

  it('单次 pointerdown で即発火する（同一ハンドラの重複呼び出しなし）', () => {
    const router = new InputRouter();
    const handler = vi.fn();
    router.registerZone({
      id: 'openDoor',
      bounds: makeRect(500, 600, 320, 64),
      priority: INPUT_PRIORITY.TABLE_ORDER,
      event: TAP_EVENTS.OPEN_DOOR,
    });
    router.on(TAP_EVENTS.OPEN_DOOR, handler);

    expect(router.handlePointerDown(660, 630)).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('未命中の点ではイベントを発火しない', () => {
    const router = new InputRouter();
    const handler = vi.fn();
    router.registerZone({
      id: 'openDoor',
      bounds: makeRect(500, 600, 320, 64),
      priority: INPUT_PRIORITY.TABLE_ORDER,
      event: TAP_EVENTS.OPEN_DOOR,
    });
    router.on(TAP_EVENTS.OPEN_DOOR, handler);

    expect(router.handlePointerDown(10, 10)).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('S-01 — 最小判定サイズと模态屏蔽', () => {
  it('BUTTON_MIN_SIZE_PX 未満の判定区は最小边長へ扩张される', () => {
    const clamped = clampTapBounds(makeRect(100, 100, 20, 20));
    expect(clamped.width).toBe(BUTTON_MIN_SIZE_PX);
    expect(clamped.height).toBe(BUTTON_MIN_SIZE_PX);
    // 对称扩张（中心は不変）
    expect(clamped.x).toBe(100 + 10 - BUTTON_MIN_SIZE_PX / 2);
  });

  it('blockingLayer 指定中は基礎判定区が屏蔽される', () => {
    const router = new InputRouter();
    const handler = vi.fn();
    router.registerZone({
      id: 'base',
      bounds: makeRect(0, 0, 100, 100),
      priority: INPUT_PRIORITY.TABLE_ORDER,
      event: TAP_EVENTS.OPEN_DOOR,
    });
    router.registerZone({
      id: 'modal',
      bounds: makeRect(0, 0, 100, 100),
      priority: INPUT_PRIORITY.PAUSE_PANEL,
      event: TAP_EVENTS.PAUSE_RESUME,
      layer: 'modal',
    });
    router.on(TAP_EVENTS.OPEN_DOOR, handler);
    router.on(TAP_EVENTS.PAUSE_RESUME, handler);

    router.setBlockingLayer('modal');
    expect(router.handlePointerDown(50, 50)).toBe(true);
    // モーダル層のみ応答 — 基礎判定区のイベントは発火しない
    expect(handler).toHaveBeenCalledTimes(1);

    router.setBlockingLayer(null);
    expect(router.handlePointerDown(50, 50)).toBe(true);
  });

  it('pointInRect は境界を半開区間として判定する', () => {
    const rect = makeRect(0, 0, 10, 10);
    expect(pointInRect(0, 0, rect)).toBe(true);
    expect(pointInRect(9, 9, rect)).toBe(true);
    expect(pointInRect(10, 5, rect)).toBe(false);
  });
});
