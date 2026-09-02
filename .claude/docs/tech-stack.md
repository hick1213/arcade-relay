# ArcadeRelay 技术栈规范（game/ 下、engine=phaser 的权威来源）

> 引擎选择见 contract.md §11（`state/engine.txt`）。本文件是 **engine=`phaser`（2D、默认）** 的权威来源。
> `unity` 请读 tech-stack-unity.md，`unreal` 请读 tech-stack-unreal.md。以下规范在选择 phaser 时全部适用。

## 技术栈（固定）

- **Phaser 3**（最新稳定版）+ **TypeScript**（strict）+ **Vite**
- `game/` 是自包含项目: 必须能通过 `cd game && npm install && npm run dev` 启动
- 原则上禁止追加运行时依赖（仅 Phaser）。构建/验证类 devDependencies 允许

## 必需的 package.json 脚本

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "typecheck": "tsc --noEmit",
    "preview": "vite preview"
  }
}
```

## 目录结构

```
game/
  index.html
  package.json / tsconfig.json / vite.config.ts
  src/
    main.ts              # 仅 Phaser.Game 初始化
    config.ts            # ★全部游戏参数（见下）
    scenes/              # BootScene / TitleScene / MenuScene / GameScene / ResultScene（contract §11 必需场景集合）
    systems/             # 游戏逻辑（不依赖 Scene 的纯类/函数）
      meta/              # 元进度逻辑（metaTypes.ts / metaSchema.ts / metaProgression.ts — 不依赖 Phaser）
    persistence/         # 持久化 I/O 层（localStorage 的唯一放置处。不得从 systems/ 直接调用）
    ui/                  # HUD、菜单等显示组件
    types.ts             # 共享类型
  assets/                # 生成资产（图像/音频/atlas）+ MANIFEST.jsonl
```

## 代码规范（rules/ 在编辑时强制执行的内容的权威来源）

1. **禁止魔法数字** — 全部游戏参数（速度、重力、分数、颜色、时间）以命名常量集中在 `src/config.ts`。调参只在 config 中完成
2. **必须使用 delta-time** — 移动、计时器使用 `update(time, delta)` 的 delta。禁止依赖帧率的实现
3. **Scene 保持轻薄** — Scene 只负责生命周期与接线。逻辑放入 `systems/` 的纯类（可单独理解、可替换）
4. **输入抽象化** — 键盘/触摸输入集中到 1 个模块（便于日后重映射、移动端适配）
5. **资产引用使用键常量** — `assets/` 的路径与纹理键经由 `src/config.ts` 的 `ASSET_KEYS`。禁止硬编码路径
6. **音频在用户操作后才开始播放** — 应对浏览器 autoplay 限制（首次输入时 resume AudioContext）
7. **支持 resize** — 默认使用 `Phaser.Scale.FIT` + `autoCenter`
8. **场景构成固定** — BootScene / TitleScene / MenuScene / GameScene / ResultScene（contract §11 必需场景集合。正规流程: Boot→Title→Menu→Game→Result→{Game|Menu}）。MenuScene 的必需要素: 开始游戏、游戏外显示（解锁/成就/统计）、设置（音量、操作说明）、退出入口
9. **持久化 I/O 集中在 `src/persistence/`** — 不得从 `systems/`、`scenes/`、`ui/` 直接调用 `localStorage`。元进度逻辑（`systems/meta/`）只接收值并返回值（参见「存档 / 持久化」节）

## 存档 / 持久化（contract §6 存档规范的 phaser 实现权威来源）

- **保存位置**: `localStorage` 键 `arcaderelay-save`。格式为 JSON，首字段 `save_version`（number、必需）
- **层的分离**（contract §11）: 元进度逻辑 = `src/systems/meta/`（`metaTypes.ts`=按版本区分的普通类型 / `metaSchema.ts`=迁移函数链+验证 / `metaProgression.ts`=接收 RunResult 并返回新 SaveData 的纯 reducer）。I/O = `src/persistence/`（`SaveAdapter` 实现。只有这里引用 `localStorage` — 测试中要能注入内存 Storage）
- **迁移**: 依次应用 v(n)→v(n+1) 的函数。比当前版本更新的版本不做转换，按损坏处理（禁止隐式降级）。函数只增不改
- **损坏时协议（禁止静默初始化 — rules/gameplay-code.md 强制执行）**: 解析失败、`save_version` 缺失、未来版本、schema 验证失败（必需字段缺失、类型错误）中的任一情况，均 (1) 将原始数据备份保存到 `arcaderelay-save.bak.<epoch>` 键 → (2) 执行 1 次 `console.error('[SaveCorruption] reason=... backup=...')` → (3) 以默认值重新生成并把 `recovered: true` 传递到 UI 层（Title/Menu）
- **保存时机**: 到达 Result 时 `applyRunResult` → 立即 persist 1 次（连续重开不得重复保存）
- **测试规范**: 不使用真实 `localStorage`，注入内存 Storage mock（必须包含两项测试: 保存→新实例重新加载→恢复一致，损坏→`.bak`+错误 1 次+默认值恢复）

## 验证命令（每个实现 story + 批处理）

- 每个实现 story（并行 lane 中）: 执行 `npm run typecheck`，**只把自己编辑的文件引起的错误清零**（其他 lane 的 WIP 半成品、对其他 lane 将要提供的 API 的引用所引起的错误可以忽略 — 批处理验证是最终确认。`tsc --noEmit` 不写文件、并行安全，但结果中可能混入其他 lane 的 WIP）。**lane 中不得执行 `npm run build`**（dist/ 会与其他 lane 冲突 — retro-e2 方案A+B 的验证批处理化）
- lane 合流后的批处理验证区间（串行）: `npm run typecheck && npm run build` exit 0。失败时用错误的文件路径和 `git log --oneline -- <path>` 定位原因 story，并把最小修复与原因 story 记录到 `state/reviews/batch-verify.md`（权威实现是 workflow 的 batchVerify）
- headless 浏览器中 console 错误为 0（在 QA-PLAY Gate 实施。包含必需场景切换 Title→Menu→Game→Result→Menu 与持久化验证 — gates.md QA-PLAY 要点2/5）

## 面向未来引擎无关化的边界划分

- `systems/` 不 import/引用 Phaser API、`localStorage`（仅类型与数值逻辑）— 这里是引擎无关层（`systems/meta/` 同样）
- Phaser 依赖封闭在 `scenes/` `ui/` `main.ts` 中，浏览器持久化 API 封闭在 `persistence/` 中
