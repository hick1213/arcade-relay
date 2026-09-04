# ArcadeRelay — Claude Code compatibility instructions

> Codex uses the project-level `AGENTS.md`. This file remains as a compatibility
> entry point for Claude Code users; shared harness files live under `.codex/`.

一次头脑风暴 → agent 群通过数小时的自主工作，从头到尾做出一款可玩的游戏的 harness。支持 3 种引擎（contract §11、`state/engine.txt`）: **phaser**（浏览器 2D、Phaser 3 + TypeScript + Vite、默认）/ **unity**（3D、Unity 6 LTS）/ **unreal**（3D、UE 5.x）。人类仅在 3 个 Checkpoint（A: 策划设计批准 / B: 原型 feedback / C: 成品验收）介入。

## 使用方法（入口）

ArcadeRelay 的命令命名空间为兼容性考虑保持为 `/forge`。

- `/forge` — 主入口。preflight → 头脑风暴 → 依次自主执行 3 个阶段
- `/forge-status` — 显示当前位置与下一步操作
- 单独执行: `/forge-brainstorm` `/forge-concept` `/forge-prototype` `/forge-build`

## 绝对规范

1. **命名、ID、路径遵循 contract** — 禁止自创。 @.codex/docs/contract.md
2. **所有产出物都要经过 produce→review→revise 循环** — 合格标准见 @.codex/docs/review-loops.md
3. **游戏实现遵循按引擎区分的 tech-stack 规范** — phaser: @.codex/docs/tech-stack.md / unity: `.codex/docs/tech-stack-unity.md` / unreal: `.codex/docs/tech-stack-unreal.md`（engine 见 `state/engine.txt`。不存在则为 phaser）
4. **资产生成遵循路由表** — @.codex/docs/assets-config.md
5. **状态以文件为事实** — 读取 `state/` 而不是对话。工作后更新 `state/active.md`
6. **支柱（P-xx）是北极星** — 所有设计、实现、QA 判断都对照 `design/concept.md` 的支柱

## 流水线全貌

@.codex/docs/pipeline.yaml 定义各阶段。Gate 判定提示词见 @.codex/docs/gates.md 。

## 本仓库的结构

- `.codex/` — harness 本体（agents / skills / workflows / hooks / rules / docs / tests）
- `design/` `docs/` `qa/` `state/` — 流水线生成的产出物与状态
- `game/` — 生成的自包含游戏项目（内容按 engine 区分: Vite+TS+Phaser / Unity / UE — contract §11）
