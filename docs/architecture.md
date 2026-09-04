# Architecture — 江湖客满

> engine=phaser（Phaser 3 + TypeScript strict + Vite）。权威规范: `.codex/docs/tech-stack.md`。
> 本文件定义场景构成、系统边界、数据流。数值初始值一律以 `design/gdd.md`「数值表」为准，抄写进 `game/src/config.ts`。

## 1. 场景构成（contract §11 必需场景集合）

| Scene | 职责 | 迁移 |
|---|---|---|
| `BootScene` | 经 `ASSET_KEYS` 加载 assets/；经 persistence 层读取 SaveData（含损坏协议） | → Title |
| `TitleScene` | 标题画面（emblem=IMG-29＋i18n 标题文字）。任意点击迁移（首次输入 resume AudioContext）。`recovered` 标志存在时显示 1 次存档损坏通知 | → Menu |
| `MenuScene` | 必需要素: 开始游戏（继续周目=有 run 快照时显示／新周目）、游戏外显示（结局图鉴/成就/统计面板）、设置（BGM/SFX 音量滑块实时作用于 `sound.volume`、语言、操作说明）、退出入口（返回标题） | → Game（继续/新周目）、→ Title |
| `GameScene` | 周目内全部玩法。晨/日/夜为**场景内状态机**（`dayCycle`），无场景跳跃。志向选择（新周目第 1 晨前）也在本场景内 | → Result（破产即时／第 20 日终战后） |
| `ResultScene` | 败局/终战胜负/3 结局＋总评分。applyRunResult→立即 persist（终战败除外，见 §4） | → Game（重试当日=仅终战败／再来一周目）、→ Menu |

标准流程: `Boot → Title → Menu → Game → Result → { Game | Menu }`（contract §11）。

## 2. 目录与系统边界

```
game/src/
  main.ts          # 仅 Phaser.Game 初始化（Scale.FIT + autoCenter）
  config.ts        # ★全部游戏参数（GDD 数值表抄写）+ ASSET_KEYS（tech-stack 规范 1/5）
  types.ts         # 跨层共享的引擎无关类型
  scenes/          # Phaser 依赖封闭层①: Boot/Title/Menu/Game/Result（轻薄，只做生命周期与接线）
  ui/              # Phaser 依赖封闭层②: HUD、菜单面板、事件卡/结算面板显示组件
  systems/         # 引擎无关核心（禁止 import Phaser、禁止 localStorage）
    meta/          # 元进度逻辑: metaTypes.ts / metaSchema.ts / metaProgression.ts（纯 reducer）
    input/         # 点击输入抽象化模块（tech-stack 规范 4）
    i18n/          # 5 语言文案表与查表逻辑（缺 key 回落中文 + console.warn 1 次）
    dayCycle.ts    # 一日相位控制器（晨→日→夜纯状态机）
    assignment.ts  # 岗位分配（4 类岗位容量约束）
    training.ts    # 修练成长（属性+1、3 档成长阶段）
    customerFlow.ts / order.ts / kitchen.ts  # 客人流/订单链/后厨制菜
    economy.ts     # 银子/声望加算、工钱、破产判定
    eventCard.ts   # 事件卡抽取与执行（AMBITION_BIAS 偏移）
    ambition.ts    # 志向参数包（初始资源/偏移/结局权重）
    finalBattle.ts / ending.ts               # 终战 3 回合演出逻辑 / 结局 argmax 判定
    runSnapshot.ts # run 快照序列化（纯函数）
  persistence/     # 持久化 I/O 层（唯一 localStorage 引用处，键 arcaderelay-save）
```

### 引擎无关核心（Systems）的边界划分

- `systems/` 全部为纯 TypeScript（类/函数），**不 import Phaser、不引用 localStorage / 浏览器 API**。计时以 ms 数值（`delta`）为输入，渲染以状态数据为输出 — 可单独理解、可替换、可在无 DOM 环境测试。
- Phaser 依赖封闭在 `scenes/` `ui/` `main.ts`；浏览器持久化 API 封闭在 `persistence/`。
- GameScene 的接线模式: `update(time, delta)` → `dayCycle.advance(delta)` 等纯逻辑 → 状态变化事件 → `ui/` 组件渲染。Scene 不写玩法规则，systems 不感知显示对象。

## 3. 数据流

```
localStorage ──(SaveAdapter: load/save, 损坏时 .bak+[SaveCorruption]+默认值+recovered)──▶ SaveData
SaveData.run ──▶ GameScene 恢复 ──▶ dayCycle / 各 systems（纯逻辑, delta 驱动）
  日结算 ──▶ runSnapshot ──▶ SaveData.run 更新 ──▶ persistence.save
  周目终结 ──▶ RunResult ──▶ meta/metaProgression.applyRunResult（纯 reducer）──▶ 新 SaveData ──▶ 立即 persist
设置变更（Menu）──▶ SaveData.settings ──▶ persistence.save ＋ 实时作用于 sound.volume
```

- 输入: pointer down → `systems/input/`（命中检测＋优先级仲裁: 暂停面板 > 事件卡选项 > 出餐口 > 收钱气泡 > 点单桌）→ 语义化事件（`onTableTap` 等）→ 各 system。全部单次点击即触发，判定区 ≥ `BUTTON_MIN_SIZE_PX`。
- 保存时机（gdd「元进度」）: 志向确认时（run 首写）、每夜结算后、周目终结时（applyRunResult→persist 1 次）、设置变更时。连续重开不重复保存。
- i18n: 全部文案经 key 查表，5 语言齐备、缺 key 回落中文。系统层禁止硬编码文案。

## 4. 关键设计决定

- **晨/日/夜为场景内状态机而非场景迁移** — 单画面游戏（concept P-04、Out of scope「多场景」）。`dayCycle` 以 `DAY_SERVICE_DURATION_S`（唯一硬计时）推进日间；晨间/夜间为无强制时限的回合相位。
- **applyRunResult 的时机分支** — 破产/终战胜: ResultScene 进入时立即执行并 `run := null`；终战败: 保留 run 快照到重试抉择后（防 Menu 残留「继续周目」恢复死周目）。
- **资产引用** — 全部经 `config.ts` 的 `ASSET_KEYS`（IMG-xx 对应文件按 design/assets.md 登记），禁止硬编码路径。图像 30/SFX 8/BGM 2 满额，程序化差分（tint/缩放/表情贴片）承担 P-02 成长可视化，不新增资产。
- **程序化差分的数据契约** — `training` 输出成长阶段（3 档），`ui/` 依据阶段切换台词库与差分渲染参数，`systems/` 不持有显示对象。
