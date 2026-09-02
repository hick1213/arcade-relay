---
paths: ["game/src/**"]
---

# gameplay-code — 编辑 game/src 时的强制规范

权威来源: `.claude/docs/tech-stack.md`。违反会在 CR-CODE Gate 中得到 CONCERNS 以上的判定。

## Do / Don't

- **Do**: 游戏参数（速度、重力、HP、分数、时间、颜色、尺寸）集中到 `src/config.ts` 的命名常量。调优必须仅通过编辑 config.ts 即可完成
- **Don't**: 不要在 Scene 或 system 的正文中直接写数值字面量（数组 index、`0`/`1` 初始值等无语义的值除外）
- **Do**: 移动、计时器、冷却以 `update(time, delta)` 的 `delta`（ms）进行缩放
- **Don't**: 不要写每帧固定加算（`x += 5`）。禁止以 60fps 为前提的实现
- **Don't**: 不要在 `src/systems/` 中 import `phaser`。systems 是引擎无关层（仅类型与数值逻辑）。Phaser 依赖封闭在 `scenes/` `ui/` `main.ts` 中
- **Do**: Scene 只负责生命周期与接线（system 的创建、输入的传递、渲染反映）。判定、状态迁移、分数计算的逻辑放到 `systems/` 的纯类/函数中
- **Do**: 纹理键、资产路径经由 `src/config.ts` 的 `ASSET_KEYS` 引用
- **Don't**: 禁止 `this.load.image('hero', 'assets/hero.png')` 这类字符串直写
- **Do**: 键盘/触摸输入集中到唯一的输入模块（不要在每个 Scene 中分散 `addKey`）
- **Do**: 持久化 I/O（`localStorage`）仅在 `src/persistence/` 中进行。元进度逻辑放在 `src/systems/meta/` 的纯 reducer（接收值并返回值）中（tech-stack.md「存档 / 持久化」）
- **Don't**: 不要从 `systems/`、`scenes/`、`ui/` 直接调用 `localStorage`
- **Don't**: **存档损坏时不得静默初始化** — 解析失败、`save_version` 缺失、未来版本、schema 验证失败（必需字段缺失、类型不正确）必须执行三件套: (1) 备份保存到 `.bak` 键 (2) `console.error('[SaveCorruption] ...')` 1次 (3) 以默认值重新生成＋传播 `recovered` 标志（contract §6）。仅 catch 后返回默认值的实现、按字段填入默认值的实现在 CR-CODE 中为 CONCERNS 以上

## 正误示例

### 魔法数字

```ts
// NG: Scene 中直写数值
this.player.setVelocityX(220);
if (score > 1000) this.levelUp();

// OK: 集中到 config.ts
// src/config.ts
export const PLAYER = { MOVE_SPEED: 220 } as const;
export const SCORE = { LEVEL_UP_THRESHOLD: 1000 } as const;

// 使用侧
this.player.setVelocityX(PLAYER.MOVE_SPEED);
if (score > SCORE.LEVEL_UP_THRESHOLD) this.levelUp();
```

### delta-time

```ts
// NG: 依赖帧率（120fps 时变为2倍速）
update() {
  this.x += 5;
  this.cooldown -= 1;
}

// OK: 以 delta（ms）缩放
update(time: number, delta: number) {
  this.x += PLAYER.MOVE_SPEED * (delta / 1000);
  this.cooldown = Math.max(0, this.cooldown - delta);
}
```

### systems/ 的引擎无关

```ts
// NG: src/systems/combat.ts
import Phaser from 'phaser';                          // 禁止
export class Combat { hit(s: Phaser.GameObjects.Sprite) { /* ... */ } }

// OK: src/systems/combat.ts — 仅类型与数值逻辑
import { COMBAT } from '../config';
import type { EntityState } from '../types';
export function applyHit(target: EntityState, damage: number): EntityState {
  return { ...target, hp: Math.max(0, target.hp - damage) };
}
```

### 资产引用

```ts
// NG
this.load.image('hero', 'assets/sprites/hero.png');

// OK: src/config.ts
export const ASSET_KEYS = {
  HERO: { key: 'sprite-hero', path: 'assets/sprites/sprite-hero.png' },
} as const;

// 使用侧
this.load.image(ASSET_KEYS.HERO.key, ASSET_KEYS.HERO.path);
```
