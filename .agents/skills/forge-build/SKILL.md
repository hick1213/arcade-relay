---
name: forge-build
description: 用 full-build.js workflow 自主执行 Phase 3（正式实现与打磨），进行 Checkpoint C（成品交付）并把 stage 从 build 推进到 done。
---

Codex invocation: `$forge-build`.

# /forge-build — Phase 3: 正式实现与打磨（自主）

消化 Checkpoint B 的反馈并实现全部 story，经过资产正式生成与完整 QA 后交付成品。

## Phase 0: 前提检查

| 前提 | 确认 | 不存在时的处理 |
|---|---|---|
| `state/checkpoint-b-feedback.md` | 用 Read 确认存在 | 提示「Checkpoint B 未执行。请先执行 `/forge-prototype`」并**停止**（full-build.js 的必需输入） |
| `docs/architecture.md` `docs/conventions.md` `state/stories.yaml` `qa/report.md` ＋ 引擎的项目标记（contract §11） | 用 Glob 确认全部存在 | 有缺失则指引到 `/forge-prototype` 并停止 |
| `state/engine.txt` | Read（不存在则为 `phaser`） | unity/unreal 时也确认 `state/engine-info.json` 的 binary 实际存在，不存在则指引到 `/forge` 的引擎 preflight 并**停止** |
| `state/asset-routing.json` | 用 Read 确认存在 | 提示「preflight 未执行。请先执行 `/forge`」并**停止**（资产正式生成对路由表的依赖最强） |
| `state/stage.txt` | Read | 若为 `concept` 之前则指引到 `/forge-prototype` 并停止。若为 `build`/`done` 则给出重新执行的覆盖警告，并用 Codex 对话询问 确认是否继续 |
| `state/review-mode.txt` | Read | 不存在则默认 `lean` |
| `state/budget.txt` | Read | 不存在则按默认 `20`（USD）处理 |

若 `$ARGUMENTS` 中有 `full|lean|solo`，仅本次用作 reviewMode。

## Phase 1: 启动工作流

按 workflow 脚本的 JSON schema 调用:

- scriptPath: `.codex/workflows/full-build.js`
- args: `{"reviewMode": "<mode>", "engine": "<state/engine.txt 的值。不存在则为 phaser>", "checkpointBFeedbackPath": "state/checkpoint-b-feedback.md"}`

启动后告知用户: 「Phase 3 已在后台开始。由于包含资产正式生成与完整 QA，这是最长的阶段。完成后会收到通知。进度可用 `/workflows` 查看。」**禁止轮询**，等待完成通知。AR-ASSET / CR-CODE / QA-PLAY / CD-CHECKPOINT 的各循环是脚本侧的职责。不在执行中逐次展示 verdict。reviewMode=`full` 时，将 workflow 在返回值中累积的 verdictHistory（全部循环的 verdict 历史）全部包含在 Phase 3 的 Checkpoint C 展示中（contract §9）。若 workflow 因预计超出预算而请求人类判断，用 Codex 对话询问 中转（继续/中止生成）。

## 从会话中断恢复（retro-e3 问题3）

workflow 执行中会话中断时的正式步骤:

1. 首先通过 state/（`state/stories.yaml` 的 status、`state/active.md`、`state/stage.txt`）与 `git log` 确定**最后完成的阶段边界**（Replan 完成 / lane 合流+batchVerify 完成 / Integrate（3D 导入）完成 / Polish batchVerify 完成 / QA round N 完成）。
2. **首选是尾部重构**: 仅将剩余工序以相同提示词、相同 schema 作为新 Workflow 启动（内联 tail script）。
3. 用 `resumeFromRunId` 直接恢复时，若未完成 agent 的重新执行结果发生变化，会引发缓存分叉连锁，产生重复提交、重复工作的风险（E3 实测: 浪费约 1h）— **仅限于刚完成后的恢复（分叉面小）时使用**。
4. 无论哪种情况，恢复前都用 `git log --oneline -20` 确认有无重复提交。

## Phase 2: 完成确认

读取完成通知的返回值。**失败结束**: 报告错误与 `/workflows` 的日志查看方法，不更改 stage 并停止。

成功时，确认必需产出物实际存在: `qa/report.md`（已更新）与 MANIFEST.jsonl（引擎别权威路径 — contract §6: phaser=`game/assets/MANIFEST.jsonl` / unity、unreal=`game/_generated/MANIFEST.jsonl`。以下称 `$MANIFEST`）。
再用 Bash 确认 engine 的 tech-stack 文档「验证命令」中 build 相当的命令 exit 0（phaser: `cd game && npm run build` / unity: `ForgeBuild.BuildMac` batchmode / unreal: 完整 BuildCookRun）。缺失、失败则视为 workflow 失败并停止。

## Phase 3: Checkpoint C 展示（成品交付）

整理并展示以下内容:

1. **游玩方法**（按引擎 — tech-stack 文档的 dev/preview 行）:
   - phaser: `cd game && npm install && npm run dev`（开发） / `cd game && npm run build && npm run preview`（生产构建）
   - unity: `open game/Build/ForgeGame.app`（已构建） / 在 Unity 编辑器中打开 game/ 并 Play
   - unreal: `open game/Build/Mac/ForgeGame.app`（已打包）
   附上操作方法（依据 design/gdd.md）的摘要
2. **QA 结果**: 用 **Codex 文件附件** 发送 `qa/report.md`，显示 QA-PLAY 最终判定与 `qa/evidence/` 的代表性截图 2～3 张
3. **成本合计**: 用 Bash 合计 `$MANIFEST` 全部行的 `cost_usd`（例: `jq -s 'map(.cost_usd) | add' "$MANIFEST"`。jq 不可用则 Read 后汇总）。以 `合计 $X.XX / 预算 $<state/budget.txt>` 的形式展示
4. **许可标记一览**: 汇总 MANIFEST 的 `license` / `must_replace`，展示以下内容:
   - `must_replace: true` 的资产（placeholder-nc 等、发布前必须替换）的件数与文件一览
   - 使用 ElevenLabs 时: 「Studio Games」条款（商用×多平台发布需咨询 Enterprise）
   - 使用 Ideogram 时: 应用内 AI 生成标注条款
   - 使用 3D 资产时: Hunyuan3D 的 Territory 排除（EU/英国/韩国）、Meshy/Tripo 的套餐条件（assets-config.md）
   - unreal 时: UE EULA（禁止将引擎代码/内容作为生成式 AI 输入、$1M 超出部分 5% 版税）
   - 共通: 在美国纯 AI 输出的著作权不确定（MANIFEST 中的人类参与记录是防御材料）
5. **未解决事项**: 各评审循环遗留的问题、妥协点、CD-CHECKPOINT 列举的已知问题，不隐瞒，全部列出
6. **评审历史（仅 reviewMode=`full`）**: 全部展示返回值的 verdictHistory（gate / artifact / iteration / verdict / findings 摘要）

展示的同时发送 **Codex 通知**（例: 「ArcadeRelay: Checkpoint C — 游戏已完成」）。
展示完成后向 `state/stage.txt` 仅 Write `build` 一个词。

## Phase 4: 验收确认

- **full / lean**: 用 Codex 对话询问 确认。选项: 「验收（完成）」「请求修改（内容填入 Other）」。
  - **验收** → 进入 Phase 5。
  - **修改请求** → 执行以下操作后停止:
    1. **由 skill 自身**向 `state/checkpoint-b-feedback.md` **追加写入**以下内容（用 Edit 添加到末尾。禁止覆盖现有内容）:
       ```markdown
       ## Checkpoint C 修改请求（<ISO8601 — `date -u +%Y-%m-%dT%H:%M:%SZ` 的执行输出（禁止推测填写 — contract §7）>）
       <修改请求的内容全文>
       ```
    2. 将内容摘要也记录到 `state/active.md` 的未解决事项
    3. 指引: 「stage 保持为 `build`。重新执行 `/forge-build` 时，刚追加写入的反馈将被反映」
- **solo**: 不停止。仅展示与通知即视为已验收，进入 Phase 5（未解决事项须全部包含在展示内容中）。

## Phase 5: 完成处理

1. 向 `state/stage.txt` 仅 Write `done` 一个词
2. 更新 `state/active.md`: 当前位置=「done、交付完成」、下一步操作=「无（调参在引擎别 config 权威来源中即可完成 — contract §11: phaser=game/src/config.ts / unity=GameConfig.cs / unreal=GameConfig.h）」、未解决事项=许可标记与 must_replace 一览
3. 收尾指引: 复述游玩方法命令，并告知「参数调整仅在引擎别 config 权威来源（phaser: `game/src/config.ts` / unity: `game/Assets/Scripts/GameConfig.cs` / unreal: `game/Source/ForgeGame/GameConfig.h`）中即可完成」
