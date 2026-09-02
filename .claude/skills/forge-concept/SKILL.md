---
name: forge-concept
description: 用 concept-design.js workflow 自主执行 Phase 1（策划与设计），向人类展示 Checkpoint A（策划设计批准）并把 stage 设为 concept。
argument-hint: "[review-mode 覆盖（full|lean|solo、省略时用 state/review-mode.txt）]"
allowed-tools: Read, Glob, Grep, Write, Edit, Bash, Workflow, Task, AskUserQuestion, SendUserFile, PushNotification
---

# /forge-concept — Phase 1: 策划与设计（自主）

以 brief 为输入自主生成 concept / gdd / art-bible / assets manifest，在 Checkpoint A 取得人类批准。

## Phase 0: 前提检查

| 前提 | 确认 | 不存在时的处理 |
|---|---|---|
| `design/brief.md` | 用 Read 确认存在 | 提示「没有 brief。请先执行 `/forge-brainstorm`」并**停止** |
| `state/asset-routing.json` | 用 Read 确认存在 | 提示「preflight 未执行。请先执行 `/forge`」并**停止**（key image 生成依赖路由表） |
| `state/engine.txt` | Read（不存在则按 `phaser` 处理） | unity/unreal 时也确认 `state/engine-info.json`，不存在则提示「引擎 preflight 未执行。请先执行 `/forge`」并**停止** |
| `state/review-mode.txt` | Read | 不存在则使用默认 `lean`（无需创建文件） |
| `state/stage.txt` | Read | 若为 `concept` 之后则警告「Phase 1 已完成。重新执行将覆盖 design/ 下的内容」，并用 AskUserQuestion 确认是否继续 |

若 `$ARGUMENTS` 中有 `full|lean|solo`，**仅本次**将其用作 reviewMode（不改写 `state/review-mode.txt`）。

## Phase 1: 启动工作流

用 Workflow 工具启动:

- scriptPath: `.claude/workflows/concept-design.js`
- args: `{"briefPath": "design/brief.md", "reviewMode": "<Phase 0 决定的 mode>", "engine": "<state/engine.txt 的值。不存在则为 phaser>"}`

启动后告知用户: 「Phase 1 已在后台开始。完成后会收到通知。执行中的进度可用 `/workflows` 查看。」

**禁止轮询**。等待完成通知。workflow 内的 produce→review→revise 循环（DR-CONCEPT / DR-GDD / AR-BIBLE、review-loops.md）是脚本侧的职责，本 skill 不介入。不在执行中逐次展示 verdict。reviewMode=`full` 时，将 workflow 在返回值中累积的 verdictHistory（全部循环的 verdict 历史）全部包含在 Phase 3 的 Checkpoint A 展示中（contract §9）。

## Phase 2: 完成确认

收到完成通知后读取返回值。**失败结束时**: 报告错误内容与 `/workflows` 的日志查看方法，不更改 `state/stage.txt` 并停止（重新执行用 `/forge-concept`）。

成功时，用 Glob/Read 确认 pipeline.yaml 的必需产出物实际存在:
`design/concept.md` `design/gdd.md` `design/art-bible.md` `design/art-bible.json` `design/assets.md`
有缺失则视为 workflow 失败并停止。

## Phase 3: Checkpoint A 展示

将返回值的 Checkpoint A 材料整理为以下形式:

1. **摘要**（5 分钟内可判断的篇幅）: 要做什么策划（1 段）／支柱 P-xx 一览／核心循环 1 句
2. **产出物路径**: 上述 5 个文件
3. **Key image 候选**: 将返回值记载的候选图像**用 SendUserFile（display: render）显示**。附注: 此处批准的 1 张将成为 `design/art-bible.json` 风格锁定的基准
4. **未解决问题**: 评审循环到达 MAX_ITER 而遗留的问题（来自 `state/reviews/*.md`）。不隐瞒，全部列举
5. **评审历史（仅 reviewMode=`full`）**: 全部展示返回值的 verdictHistory（gate / artifact / iteration / verdict / findings 摘要）

展示的同时发送 **PushNotification**（例: 「ArcadeRelay: Checkpoint A（策划设计批准）已准备就绪」）。

### reviewMode = solo 时

**不停止**。仅进行上述展示与 PushNotification，key image 视为采用候选第 1 位，直接进入 Phase 5。

## Phase 4: 批准循环（仅 full / lean）

用 AskUserQuestion 请求判断。选项:
「批准（按此内容进入 Phase 2）」「将 Key image 替换为其他候选后批准（用 Other 指定哪一张）」「修改指示（内容填入 Other）」

- **批准** → 进入 Phase 5。
- **替换 Key image** → **用 Task 指示 art-director** 以所选候选为基准更新 `design/art-bible.json`，更新后进入 Phase 5。
- **修改指示** → 按以下步骤（**重新展示最多 1 次**）:
  1. 将指示全文 Write 到 `state/checkpoint-a-feedback.md`（明确日期时间与目标产出物）
  2. 根据目标用 Task 让 producer 反映: concept.md / gdd.md → `game-designer`、art-bible / key image → `art-director`、assets.md → `art-director`（按 review-loops.md 的对应表）
  3. 用修改后的产出物重新执行 Phase 3 的展示，再次 AskUserQuestion
  4. 第 2 次仍未获批准时: 将剩余问题追加写入 `state/checkpoint-a-feedback.md`，用 AskUserQuestion 确认「带着未解决事项批准 / 在此中断（stage 保持不变）」二选一。中断则停止

## Phase 5: 状态更新与下一步指引

1. 向 `state/stage.txt` 仅 Write `concept` 一个词
2. 更新 `state/active.md`: 当前位置=「Checkpoint A 已批准（solo 时为自动通过）」、下一步操作=「/forge-prototype」、未解决事项=遗留问题
3. 指引: 「已通过 Checkpoint A。接下来用 `/forge-prototype` 制作可玩的垂直切片。」
