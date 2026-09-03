/**
 * InputRouter — 点击输入抽象化模块（tech-stack.md 规范 4 / conventions 规则 2・7）。
 *
 * - 唯一的点击输入入口: scenes/ui 层只把 pointerdown 的坐标传入
 *   `handlePointerDown(x, y)`，其余一切交互经此模块仲裁与派发。
 * - 全部交互为单次点击即触发 — 不依赖 pointerup / 双击 / 长按 / 拖拽（P-04）。
 * - 命中检测＋优先级仲裁都在本模块内完成（conventions 规则 7）:
 *   重叠判定区只触发优先级最高的一方（gdd「输入」节顺序）。
 * - 引擎无关: 不 import Phaser、不引用 localStorage，可在无 DOM 环境测试。
 */
import { BUTTON_MIN_SIZE_PX } from '../../config';
import type { Rect, TapEventName, TapEventHandler, TapHit, TapZone } from '../../types';

/** 判定区不足 BUTTON_MIN_SIZE_PX 时向四周对称扩张到最小边长（P-04 触控要求） */
export function clampTapBounds(bounds: Rect): Rect {
  const width = Math.max(bounds.width, BUTTON_MIN_SIZE_PX);
  const height = Math.max(bounds.height, BUTTON_MIN_SIZE_PX);
  return {
    x: bounds.x - (width - bounds.width) / 2,
    y: bounds.y - (height - bounds.height) / 2,
    width,
    height,
  };
}

export function pointInRect(x: number, y: number, bounds: Rect): boolean {
  return (
    x >= bounds.x &&
    x < bounds.x + bounds.width &&
    y >= bounds.y &&
    y < bounds.y + bounds.height
  );
}

/**
 * 点击输入路由器（单一持有者类 — conventions「类型设计」节）。
 * Scene 侧接线模式: `this.input.on('pointerdown', (p) => router.handlePointerDown(p.x, p.y))`
 */
export class InputRouter {
  private readonly zones = new Map<string, TapZone>();
  private readonly handlers = new Map<TapEventName, Set<TapEventHandler>>();
  /** 模态层 id（如暂停面板）。非 null 期间仅该层的判定区响应，其余全部屏蔽 */
  private blockingLayer: string | null = null;

  registerZone(zone: TapZone): void {
    this.zones.set(zone.id, { ...zone, bounds: clampTapBounds(zone.bounds) });
  }

  unregisterZone(zoneId: string): void {
    this.zones.delete(zoneId);
  }

  clearZones(): void {
    this.zones.clear();
  }

  /** 模态层开启（如暂停面板）。传入 null 解除屏蔽 */
  setBlockingLayer(layerId: string | null): void {
    this.blockingLayer = layerId;
  }

  /**
   * 命中检测＋优先级仲裁: 同时命中多个判定区时只返回优先级最高的一方
   * （同优先级按注册顺序，保证确定性）。未命中返回 null。
   */
  resolveTap(x: number, y: number): TapHit | null {
    const eligible = [...this.zones.values()].filter(
      (zone) => this.isEligible(zone) && pointInRect(x, y, zone.bounds),
    );
    let best: TapZone | undefined;
    for (const zone of eligible) {
      if (best === undefined || zone.priority > best.priority) {
        best = zone;
      }
    }
    if (best === undefined) {
      return null;
    }
    return {
      zoneId: best.id,
      event: best.event,
      payload: best.payload ?? {},
      x,
      y,
    };
  }

  /** pointerdown 直通入口。命中时派发语义化事件并返回 true（单次点击即触发） */
  handlePointerDown(x: number, y: number): boolean {
    const hit = this.resolveTap(x, y);
    if (hit === null) {
      return false;
    }
    const handlers = this.handlers.get(hit.event);
    if (handlers !== undefined) {
      for (const handler of handlers) {
        handler(hit);
      }
    }
    return true;
  }

  on(event: TapEventName, handler: TapEventHandler): void {
    const handlers = this.handlers.get(event) ?? new Set<TapEventHandler>();
    handlers.add(handler);
    this.handlers.set(event, handlers);
  }

  off(event: TapEventName, handler: TapEventHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  private isEligible(zone: TapZone): boolean {
    if (this.blockingLayer === null) {
      return true;
    }
    return zone.layer === this.blockingLayer;
  }
}
