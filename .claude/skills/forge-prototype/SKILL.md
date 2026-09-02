---
name: forge-prototype
description: 用 prototype.js workflow 自主执行 Phase 2（原型），回收 Checkpoint B（对可玩垂直切片的反馈）并把 stage 设为 prototype。
argument-hint: "[review-mode 覆盖（full|lean|solo、省略时用 state/review-mode.txt）]"
allowed-tools: Read, Glob, Grep, Write, Edit, Bash, Workflow, Task, AskUserQuestion, SendUserFile, PushNotification
---

# /forge-prototype — Phase 2: 原型（自主）

从已批准的策划与设计出发，自主实现「可玩的垂直切片」（启动→核心循环 1 周→重开），在 Checkpoint B 回收人类的一次反馈。反馈将成为 Phase 3（/forge-build）的输入。

## Phase 0: 前提检查

| 前提 | 确认 | 不存在时的处理 |
|---|---|---|
| `design/concept.md` `design/gdd.md` `design/art-bible.md` `design/art-bible.json` `design/assets.md` | 用 Glob/Read 确认全部存在 | 缺少任一个则提示「Phase 1 的产出物不足。请先执行 `/forge-concept`」并**停止** |
| `state/asset-routing.json` | 用 Read 确认存在 | 提示「preflight 未执行。请先执行 `/forge`」并**停止**（占位符资产生成依赖路由表） |
| `state/engine.txt` | Read（不存在则为 `phaser`） | unity/unreal 时也确认 `state/engine-info.json` 的 binary 实际存在，不存在则提示「引擎 preflight 未执行。请先执行 `/forge`」并**停止** |
| `state/stage.txt` | Read | 若为 `brief` 之前则指引到 `/forge-concept` 并停止。若为 `prototype` 之后则警告重新执行将覆盖 game/，并用 AskUserQuestion 确认是否继续 |
| `state/review-mode.txt` | Read | 不存在则默认 `lean` |
| `state/checkpoint-a-feedback.md` | Read（**可选**） | 可不存在（Checkpoint A 无修改批准时不存在） |

若 `$ARGUMENTS` 中有 `full|lean|solo`，仅本次用作 reviewMode。

## Phase 1: 启动工作流

用 Workflow 工具启动:

- scriptPath: `.claude/workflows/prototype.js`
- args: `{"reviewMode": "<mode>", "engine": "<state/engine.txt 的值。不存在则为 phaser>", "checkpointAFeedbackPath": "state/checkpoint-a-feedback.md"}`
  （`state/checkpoint-a-feedback.md` 不存在时**省略** `checkpointAFeedbackPath` — contract §4 中为 optional）

启动后告知用户: 「Phase 2 已在后台开始。完成后会收到通知。进度可用 `/workflows` 查看。」**禁止轮询**，等待完成通知。story 实现循环（CR-CODE）与 QA-PLAY 是脚本侧的职责。不在执行中逐次展示 verdict。reviewMode=`full` 时，将 workflow 在返回值中累积的 verdictHistory（全部循环的 verdict 历史）全部包含在 Phase 3 的 Checkpoint B 展示中（contract §9）。

## 从会话中断恢复（retro-e3 问题3）

workflow 执行中会话中断时的正式步骤:

1. 首先通过 state/（`state/stories.yaml` 的 status、`state/active.md`、`state/stage.txt`）与 `git log` 确定**最后完成的阶段边界**（Setup 完成 / lane 合流+batchVerify 完成 / Integrate 完成 / QA round N 完成）。
2. **首选是尾部重构**: 仅将剩余工序以相同提示词、相同 schema 作为新 Workflow 启动（内联 tail script）。
3. 用 `resumeFromRunId` 直接恢复时，若未完成 agent 的重新执行结果发生变化，会引发缓存分叉连锁，产生重复提交、重复工作的风险（E3 实测: 浪费约 1h）— **仅限于刚完成后的恢复（分叉面小）时使用**。
4. 无论哪种情况，恢复前都用 `git log --oneline -20` 确认有无重复提交。

## Phase 2: 完成确认

读取完成通知的返回值。**失败结束**: 报告错误与 `/workflows` 的日志查看方法，不更改 stage 并停止。

成功时，确认 pipeline.yaml 的必需产出物实际存在（带 engine 字段的产出物仅限对应 engine 的）:
`docs/architecture.md` `docs/conventions.md` `state/stories.yaml` `qa/report.md` ＋ 引擎的项目标记（contract §11: phaser=`game/package.json` / unity=`game/ProjectSettings/ProjectVersion.txt` / unreal=`game/ForgeGame.uproject`）
再用 Bash 轻量地重新确认 engine 的 tech-stack 文档「验证命令」中 typecheck 相当的命令 exit 0（phaser: `cd game && npm run typecheck`。依赖未安装则先执行 `npm install` / unity: EditMode 测试 / unreal: BuildCookRun -build）。缺失、失败则视为 workflow 失败并停止。

## Phase 3: Checkpoint B 展示

整理并展示以下内容:

1. **游玩方法**（按引擎 — tech-stack 文档的 dev/preview 行）:
   - phaser: `cd game && npm install && npm run dev`（启动 URL 为 Vite 默认 http://localhost:5173）
   - unity: `open game/Build/ForgeGame.app`（已构建）或在 Unity 编辑器中打开 game/
   - unreal: `open game/Build/Mac/ForgeGame.app`（已打包）
   附上操作方法（摘要 design/gdd.md 的操作定义）
2. **游玩证据**: 用 **SendUserFile（display: render）** 显示 `qa/evidence/` 的截图（代表性 3～5 张）。同时附上 `qa/report.md` 的路径与 QA-PLAY 判定结果
3. **已实现的 story**: `state/stories.yaml` 中 phase: prototype 部分的 id / title / status 一览
4. **已知问题**: CR-CODE / QA-PLAY 评审循环中遗留的未解决问题（来自 `state/reviews/*.md`），不隐瞒，全部列举
5. **评审历史（仅 reviewMode=`full`）**: 全部展示返回值的 verdictHistory（gate / artifact / iteration / verdict / findings 摘要）

展示的同时发送 **PushNotification**（例: 「ArcadeRelay: Checkpoint B（原型）已进入可玩状态」）。

## Phase 4: 反馈回收

Checkpoint B 不是批准 Gate，而是**一次性的反馈回收**。不要在此反复「修改后重新展示」— 回收的内容由 Phase 3（正式实现）消化。

- **full / lean**: 用 AskUserQuestion 询问。选项: 「可以直接继续（无反馈）」「有反馈（内容填入 Other）」。请用户实际玩过后再回答。
- **solo**: 不停止。仅通知后进入下一步。

回收结果**必须** Write 到 `state/checkpoint-b-feedback.md`（因为是 full-build.js 的必需输入，即使没有反馈也要创建文件）:

```markdown
# Checkpoint B 反馈
- 日期时间: <ISO8601 — 粘贴 `date -u +%Y-%m-%dT%H:%M:%SZ` 的执行输出（禁止推测填写 — contract §7）>
- 模式: <full|lean|solo>
## 反馈
<正文。没有时写「无反馈。直接进入正式实现」。solo 时写「solo 模式，未回收」>
```

## Phase 5: 状态更新与下一步指引

1. 向 `state/stage.txt` 仅 Write `prototype` 一个词
2. 更新 `state/active.md`: 当前位置=「Checkpoint B 已通过」、下一步操作=「/forge-build」、未解决事项=已知问题＋回收反馈摘要
3. 指引: 「已通过 Checkpoint B。接下来用 `/forge-build` 进行正式实现与打磨（完整 QA、资产正式生成）。」
