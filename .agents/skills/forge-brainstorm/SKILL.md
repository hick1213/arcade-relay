---
name: forge-brainstorm
description: ArcadeRelay 唯一的对话阶段。用 Codex 对话询问 逐题确定游戏形象，确定 design/brief.md 并把 stage 设为 brief。
---

Codex invocation: `$forge-brainstorm`.

# /forge-brainstorm — 头脑风暴（唯一的对话阶段）

通过与用户的一问一答确定游戏形象，写出 `design/brief.md`。此处决定的内容是此后所有自主阶段（Phase 1～3）的唯一输入。**提问必须用 Codex 对话询问 逐题进行**。准备选项，自由输入交给 Other。

## Phase 0: 前提检查

| 前提 | 确认 | 不存在/命中时的处理 |
|---|---|---|
| `.codex/docs/templates/brief.md` | 用 Read 确认存在 | 不存在则为 harness 损坏。告知「找不到模板。请恢复仓库中的 `.codex/docs/templates/brief.md`」并停止 |
| `design/brief.md` | 用 Read 确认存在 | **若已存在**，用 Codex 对话询问 确认「覆盖并从头重新头脑风暴 / 保留现有 brief 并中止（→ 前往 /forge-concept）」。保留则停止 |
| `state/stage.txt` | Read（可不存在） | 若为 `concept` 之后的值，警告「可能与后续工序的产出物矛盾」后确认是否继续 |

若 `$ARGUMENTS` 中有初始想法则读取，并反映到后续提问的选项生成中（例: 「以猫为主角的射击游戏」→ 把类型问题的第一候选设为射击）。

## Phase 1: 提问访谈（Codex 对话询问、按此顺序逐题）

每题选项不超过 4 个＋Other。要根据前一题的回答把下一题的选项具体化。

0. **运行环境（引擎）** — header: `引擎`。「要做在哪个环境运行的游戏？」（contract.md §11。**必须最先问** — 此后范围、美术、资产的选项都依赖于此）
   选项: 「浏览器 2D（Phaser、默认。最快完成）」「Unity 3D（macOS 原生。使用 AI 生成的 3D 模型＋骨架资产）」「Unreal 3D（UE 5.x。前提是引擎已安装 — 未安装则需要一次 Epic 登录）」
   在问题文本中明确: 「选择 3D 引擎后，资产生成会加入 3D 路由（Meshy 直连 API primary / 经 fal 作双路冗余 — contract §10），生成成本与所需时间比 2D 增加。」
   将回答确定为 engine 值（`phaser` / `unity` / `unreal`）。
1. **玩家与游玩时长** — header: `玩家`。「谁玩、一局玩几分钟的游戏？」
   选项示例: 「自己和朋友、一局 3 分钟」「不特定的 Web 访客、一局 1 分钟」「面向儿童、一局 5 分钟」「面向核心玩家、一局 10 分钟」
2. **类型与参考作品** — header: `类型`。「接近的类型、参考作品是？」
   选项示例: 「动作（Vampire Survivors 系）」「射击（Galaga／弹幕系）」「益智（2048／Tetris 系）」「跑酷（Chrome Dino 系）」。回答后，若参考作品名模糊，再追加仅一题询问具体作品。
3. **Core fantasy** — header: `体验核心`。「玩家化身为什么、什么让人感觉爽？」
   选项从前两题的回答生成 4 案（例: 「横扫大军的无双感」「险险躲避的刺激感」）。
4. **操作** — header: `操作`。选项: 「仅方向键 / WASD」「仅鼠标」「键盘＋鼠标」「单按键（兼容触屏）」
5. **胜负** — header: `胜负`。选项: 「无尽＋最高分（无胜利）」「限时生存（存活 N 秒即胜）」「通关型（达成目标即胜）」「对 CPU 击破型」
5b. **游戏外 / 深度可玩性** — header: `深度可玩性`。「跨 run 积累什么？（最高分+统计为必需。再额外选 2 个 — contract §11 元进度必需）」
   选项从前面的胜负、类型回答生成 4 案两要素组合（例: 「货币+皮肤解锁（外观收集）」「成就+跨局升级（roguelite）」「货币+关卡解锁」「成就+统计深挖」）。不使用 multiSelect，而是让用户按组合选择（与 gdd 的采用表 1:1 对应）。
6. **范围约束** — header: `范围`。「要在数小时的自主实现中完成。堆到什么程度？」
   选项（engine=phaser）: 「最小: 1 画面、敌人 1 种、无机关」「小: 敌人 2～3 种＋机关 1 个」「中: 关卡 2～3＋Boss 1 体（上限）」。
   选项（engine=unity/unreal）: 「最小: 1 竞技场、敌人 1 种、角色 1 体」「小: 1 竞技场、敌人 2 种＋机关 1 个（角色 2 体）」「中: 竞技场 2＋Boss 1 体（上限。3D 模型 5 体以内）」。
   出现超过「中」的要求时，提出削减候选并取得共识。
7. **美术方向** — header: `美术`。
   **engine=phaser 时** — 选项: 「像素美术」「扁平 2D／矢量风」「手绘插画风」「极简图形」
   **必须在问题文本中明确**: 「选择像素美术后，全部图像生成会切换到 Retro Diffusion 路由（其他则为 fal.ai 或 OpenAI gpt-image-2 二选一 Primary，具体取决于已设置的密钥 — 详见 state/asset-routing.json）。」
   此外若 `state/asset-routing.json` 存在且 `checks.retro_diffusion.key` 为 `false`，则也要在问题文本中明确「由于未设置 Retro Diffusion 密钥，选择像素美术将采用本地降级（nearest-neighbor 缩小＋调色板量化）」，若仍选择像素美术，则视为已同意降级并记录到 brief。
   **engine=unity/unreal 时** — 选项: 「低多边形／平面着色」「风格化（卡通渲染）」「半写实 PBR」「极简几何」
   在问题文本中明确: 「3D 模型生成以 Meshy 直连 API（MESHY_API_KEY）为第一候选、经 fal.ai 为第二候选（contract §10）。两个密钥都未设置时将成为程序化占位符（must-replace）。」

## Phase 2: 确定确认

将回答整理为「引擎／玩家／类型与参考／core fantasy／操作／胜负／游戏外／范围／美术方向」的 9 行摘要，用 Codex 对话询问 确认。选项: 「按此内容确定」「想修改（用 Other 指定哪一项）」。若指定了修改，仅对该项重新执行 Phase 1 的对应问题，再回到此确认。

## Phase 3: 写出 brief.md

1. Read `.codex/docs/templates/brief.md`，**严格按照**其章节结构 Write `design/brief.md`。不要原样粘贴回答，而是整理成自主 agent 可用于判断的宣言句（例: 「敌人最多 2 种。驳回添加第 3 种的提案」）。
2. 在运行环境章节**必须明确引擎（`phaser`/`unity`/`unreal`）与维度**（contract.md §11。与 `state/engine.txt` 一致）。
3. 美术方向章节中，engine=phaser 时**必须用一行明确「像素美术: 是／否」**。这是资产**生成时**路由（是否使用 Retro Diffusion 路由 — assets-config.md）的分支条件，路由本身在 brief 确定后、`/forge` 的 preflight 再确认或 `/forge-concept` 启动时在 `state/asset-routing.json` 上决定（preflight 的执行顺序先于 brief）。engine=unity/unreal 时写 3D 风格方针（低多边形等）与多边形预算的大致目标。
4. 范围约束章节写 Phase 1-6 达成共识的上限与「不加料」宣言（3D 引擎还包括模型数上限）。
5. 游戏外 / 深度可玩性章节写 Phase 1-5b 确定的所选 2 要素与取向的一句话（templates/brief.md。成为 gdd「元进度（游戏外）」节采用表的上位约束）。

## Phase 4: 状态更新与下一步指引

1. 向 `state/engine.txt` 仅 Write engine 的一个词（`phaser`/`unity`/`unreal`）。
2. 向 `state/stage.txt` 仅 Write `brief` 一个词。
3. 更新 `state/active.md`: 当前位置=「brief 已确定（engine: <值>）」、下一步操作=「执行 /forge-concept（unity/unreal 需先经 /forge 的引擎 preflight）」、未解决事项=列举头脑风暴中推后的议题（若有）。
4. 告知用户: 「brief 已确定。接下来用 `/forge-concept` 自主执行 Phase 1（策划与设计）。此后直到 Checkpoint A 都没有对话。」
