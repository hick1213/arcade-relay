---
name: forge-status
description: ArcadeRelay 的当前位置显示（只读）。核对 .codex/docs/pipeline.yaml、state/ 与文件实体，显示当前 stage、已完成/缺失的产出物、接下来应执行的命令、state/active.md 的摘要。不写入任何内容。
---

Codex invocation: `$forge-status`.

# /forge-status — 当前位置与下一步操作的显示

**只读 skill。** 完全不做文件写入、修复、子 skill 启动。即使发现矛盾也只报告与建议。

## Phase 1: 读取状态文件

读取以下内容（不存在的按「未设置/未开始」处理）:

- `state/stage.txt` — 当前 stage（`brief|concept|prototype|build|done` 之一。不存在则为「未开始」）
- `state/engine.txt` — `phaser|unity|unreal`（不存在则为「未设置（默认 phaser）」— contract §11）
- `state/engine-info.json` — 引擎 preflight 是否已完成（仅 unity/unreal。同时确认 binary 实际存在）
- `state/review-mode.txt` — `full|lean|solo`（不存在则为「未初始化（默认 lean）」）
- `state/budget.txt` — 预算上限 USD（不存在则为「未初始化（默认 20）」）
- `state/active.md` — 会话交接（当前位置/下一步操作/未解决事项）
- `state/asset-routing.json` — preflight 是否已完成（同时确认 `degraded` 标志）
- `.codex/docs/pipeline.yaml` — stage 顺序、各 stage 的 required artifacts、command 的信息源

## Phase 2: 产出物的实体检查

将 pipeline.yaml 各 stage 的 `artifacts.required` 与实体核对（存在且非空为合格）。**带 `engine:` 字段的产出物，仅以与 `state/engine.txt` 的值（不存在则为 phaser）一致的行为对象**（参见 pipeline.yaml 开头注释）:

```bash
ENGINE="$(cat state/engine.txt 2>/dev/null || echo phaser)"
# 共通产出物
for f in design/brief.md \
         design/concept.md design/gdd.md design/art-bible.md design/art-bible.json design/assets.md \
         docs/architecture.md docs/conventions.md state/stories.yaml qa/report.md; do
  [ -s "$f" ] && echo "OK  $f" || echo "--  $f"
done
# 引擎别产出物（pipeline.yaml 的 engine 字段）
case "$ENGINE" in
  phaser) for f in game/package.json game/assets/MANIFEST.jsonl; do [ -s "$f" ] && echo "OK  $f" || echo "--  $f"; done ;;
  unity)  for f in game/ProjectSettings/ProjectVersion.txt game/_generated/MANIFEST.jsonl; do [ -s "$f" ] && echo "OK  $f" || echo "--  $f"; done ;;
  unreal) for f in game/ForgeGame.uproject game/_generated/MANIFEST.jsonl; do [ -s "$f" ] && echo "OK  $f" || echo "--  $f"; done ;;
  *) echo "!! state/engine.txt 不合法: '$ENGINE'（仅限 contract §11 的 3 值）— 无法判定引擎别产出物" ;;
esac
```

（上面的列表是 pipeline.yaml 当前值。**以读取 pipeline.yaml 的结果为准**，若有变更则遵从之。）

## Phase 3: 一致性判定与「下一命令」决定

1. **当前 stage**: `state/stage.txt` 的值。stage 值表示「该阶段已完成」（contract.md §1）。
2. **矛盾检测**: 若 stage 值所要求的产出物（到该 stage 为止的全部 required）有缺失则警告（例: stage=`concept` 但 `design/gdd.md` 缺失 → 「stage 标记与实体不一致。需要重新执行 /forge-concept」）。反之，stage 未到达但后续产出物已存在时也要注记。
3. **接下来应执行的命令**（pipeline.yaml 的 `next` → 该 stage 的 `command`）:

| 当前 stage | 下一命令 |
|---|---|
| 未开始 | `/forge`（从 preflight 开始）或 `/forge-brainstorm` |
| `brief` | `/forge-concept`（`state/asset-routing.json` 不存在则先用 `/forge` 做 preflight） |
| `concept` | `/forge-prototype` |
| `prototype` | `/forge-build` |
| `build` | `/forge-build`（重新进行验收确认。用 `/forge` 恢复也会进入 Phase 5 = 重新执行 /forge-build） |
| `done` | 无（已完成。启动命令按引擎 — phaser: `cd game && npm run dev` / unity: `open game/Build/ForgeGame.app` / unreal: `open game/Build/Mac/ForgeGame.app`） |

附注: 从任何位置都可用 `/forge` 幂等恢复。

## Phase 4: 辅助信息的汇总

仅汇总存在的内容（不存在则跳过）:

```bash
# story 进度（state/stories.yaml）
grep -c 'status: done'        state/stories.yaml
grep -c 'status: in-progress' state/stories.yaml
grep -c 'status: todo'        state/stories.yaml

# 资产成本实际 vs 预算（MANIFEST 为引擎别权威来源 — phaser: game/assets/ / unity、unreal: game/_generated/）
MANIFEST="game/assets/MANIFEST.jsonl"; [ "$ENGINE" != "phaser" ] && MANIFEST="game/_generated/MANIFEST.jsonl"
jq -s 'map(.cost_usd // 0) | add' "$MANIFEST"
cat state/budget.txt

# 发布前必须替换的资产
jq -c 'select(.must_replace == true) | .file' "$MANIFEST"

# 未解决评审（最新 iteration 以非 APPROVE 结束的文件）
grep -l 'CONCERNS\|REJECT' state/reviews/*.md 2>/dev/null
```

对 `state/reviews/*.md`，读取 grep 命中文件的**末尾 iteration 标题**（`## <GATE-ID> iteration <n> — <verdict>`），仅将最终 verdict 非 APPROVE 的视为未解决。

## Phase 5: 显示

按以下格式输出（不适用的行省略）:

```
# ArcadeRelay Status

当前 stage : <stage>（<stage 的含义>）    engine: <engine>    review-mode: <mode>    预算: $<实际> / $<上限>
preflight : <已完成（degraded: false）| 未执行>    引擎 preflight : <已完成（<version>）| 未执行 | 不需要（phaser）>

## 流水线进度
[x] brief      头脑风暴            /forge-brainstorm
[x] concept    策划与设计 (CP-A)    /forge-concept
[ ] prototype  原型 (CP-B)          /forge-prototype   ← 当前位置
[ ] build      正式实现 (CP-C)      /forge-build
[ ] done       完成

## 产出物
OK/-- 的一览（Phase 2 的结果。缺失以「缺: <path>」标注，并明确与当前 stage 是否矛盾）

## 未解决事项
- story: done <n> / in-progress <n> / todo <n>
- 未解决评审: <artifact 名与最终 verdict>
- must_replace 资产: <一览>

## 下一步操作
→ <下一命令>（理由 1 行）
※ 可用 /forge 从任何位置恢复

## state/active.md 摘要
<将当前位置/下一步操作/未解决事项摘要为 3～5 行。不存在则为「未创建」>
```
