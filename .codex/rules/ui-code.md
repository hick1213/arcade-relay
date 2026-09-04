---
paths: ["game/src/ui/**"]
---

# ui-code — 编辑 game/src/ui 时的强制规范

HUD 与菜单存在的目的是支撑玩家不到1秒的判断。gameplay-code.md 的规范（config.ts 集中、delta-time、ASSET_KEYS）同时适用。

## Do / Don't

- **Do**: 游玩中需要阅读的 HUD 要素（HP、分数、剩余时间）须做到一眼可读的尺寸与对比度。字号、颜色、坐标放在 `src/config.ts` 的 `UI` 常量中，并铺设可与背景区分的描边或半透明面板
- **Don't**: 不要把 HUD 放在游玩区域中央或操作对象的动线上。不要为了装饰牺牲可辨识性
- **Do**: UI 的显示值每次都从 game state（`systems/` 的状态）推导。UI 类只做「接收并绘制」
- **Don't**: 不要在 UI 侧持有 `score` 等状态副本做双重管理（漏加、不一致的温床）
- **Do**: 显示在画面上的文本经由 `src/config.ts` 的 `STRINGS` 常量（面向未来本地化的边界。格式化做成函数）
- **Don't**: 禁止 `this.add.text(x, y, 'Game Over')` 这类字符串直写
- **Do**: 「Press Z to jump」等输入提示中的按键显示，从实际的键位绑定定义（输入模块的分配）推导
- **Don't**: 不要在提示字符串中硬编码键名（重映射、移动端适配时显示与实际按键会错位）

## 正误示例

### UI 状态为推导（禁止双重管理）

```ts
// NG: UI 自行持有并累加分数
export class Hud {
  private score = 0;
  addScore(n: number) { this.score += n; this.text.setText(`SCORE ${this.score}`); }
}

// OK: 仅接收 game state 并绘制
import { STRINGS } from '../config';
import type { GameState } from '../types';
export class Hud {
  update(state: GameState) {
    this.scoreText.setText(STRINGS.HUD_SCORE(state.score));
  }
}
```

### 文本经由 STRINGS

```ts
// NG
this.add.text(400, 300, 'Game Over');

// OK: src/config.ts
export const STRINGS = {
  GAME_OVER: 'Game Over',
  HUD_SCORE: (n: number) => `SCORE ${n}`,
} as const;

// 使用侧
this.add.text(UI.RESULT_X, UI.RESULT_Y, STRINGS.GAME_OVER, UI.RESULT_STYLE);
```

### 输入提示从实际键位绑定推导

```ts
// NG: 键名硬编码（重映射后就成了谎言）
this.add.text(x, y, 'Press Z to jump');

// OK: 从输入模块的分配生成显示
// src/config.ts
export const KEY_BINDINGS = { JUMP: 'Z', DASH: 'X' } as const;
export const STRINGS = {
  PROMPT_JUMP: (key: string) => `Press ${key} to jump`,
} as const;

// 使用侧（引用与输入模块相同的定义）
this.add.text(x, y, STRINGS.PROMPT_JUMP(KEY_BINDINGS.JUMP), UI.PROMPT_STYLE);
```

### HUD 可辨识性

```ts
// NG: 小且低对比度，位置也是数值直写
this.add.text(10, 10, `${score}`, { fontSize: '10px', color: '#888888' });

// OK: config 的 UI 常量 + 描边与背景分离
// src/config.ts
export const UI = {
  HUD_MARGIN: 16,
  HUD_STYLE: { fontSize: '24px', color: '#ffffff', stroke: '#000000', strokeThickness: 4 },
} as const;
```
