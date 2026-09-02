# ArcadeRelay Contract — 命名、ID、路径的单一事实来源

> **本文件是所有组件（agents / skills / workflows / hooks / rules / templates）一致性的脊梁。**
> 不要自创此处没有的名称、ID、路径。修改时务必先更新此处，再让引用方跟进。

## 1. 流水线与阶段

stage 值（保存在 `state/stage.txt`。仅此 5 值）:

```
brief → concept → prototype → build → done
```

| stage | 含义 | 达成条件 |
|---|---|---|
| `brief` | 头脑风暴完成，brief 已确定 | `design/brief.md` 存在 |
| `concept` | Phase1 完成，Checkpoint A 已批准 | `design/concept.md` + `gdd.md` + `art-bible.md` 已批准 |
| `prototype` | Phase2 完成，Checkpoint B 已通过 | 可玩的垂直切片 + `state/checkpoint-b-feedback.md` |
| `build` | Phase3 完成，到达 Checkpoint C | 完整 QA 合格 |
| `done` | 交付完成 | — |

## 2. agent 名（`.claude/agents/<name>.md`、仅此 10 个）

Producer: `creative-director` `tech-director` `game-designer` `art-director` `audio-designer` `gameplay-engineer` `ui-engineer`
Reviewer: `design-reviewer` `art-reviewer` `qa-lead`

代码审查不新建 agent，使用现有的 `pr-review-toolkit:code-reviewer` / `pr-review-toolkit:silent-failure-hunter`。

## 3. skill 名（`.claude/skills/<name>/SKILL.md`、仅此 6 个）

公开名称为 ArcadeRelay，但为与现有运用兼容，命令命名空间保持为 `forge`。

`forge` `forge-brainstorm` `forge-concept` `forge-prototype` `forge-build` `forge-status`

## 4. Workflow 脚本（`.claude/workflows/<name>.js`、仅此 3 个）

| script | 调用方 skill | args（JSON） | 终点 |
|---|---|---|---|
| `concept-design.js` | `/forge-concept` | `{briefPath, reviewMode, engine?}` | 返回 Checkpoint A 材料 |
| `prototype.js` | `/forge-prototype` | `{reviewMode, engine?, checkpointAFeedbackPath?}` | 返回 Checkpoint B 材料 |
| `full-build.js` | `/forge-build` | `{reviewMode, engine?, checkpointBFeedbackPath}` | 返回 Checkpoint C 材料 |

在 Workflow 脚本内使用 harness agent 时，用 `agent(prompt, {agentType: '<agent名>'})`（直接使用 §2 的名称）。
`engine` 为 §11 的 3 值之一。**Workflow 脚本无法读取文件，因此由调用方 skill 读取 `state/engine.txt` 并传入**。省略时为 `phaser`（向后兼容）。

## 5. Gate ID 与判定格式

返回判定的 agent 必须在**响应的第 1 行**写:

```
<GATE-ID>: APPROVE | CONCERNS | REJECT
```

| Gate ID | 判定者 | 对象 |
|---|---|---|
| `DR-CONCEPT` | design-reviewer | design/concept.md |
| `DR-GDD` | design-reviewer | design/gdd.md |
| `AR-BIBLE` | art-reviewer | design/art-bible.md + key image |
| `AR-ASSET` | art-reviewer | 生成资产（单个/批次） |
| `CR-CODE` | (现有代码审查) | game/ 的代码变更（按引擎区分的对象路径见 §11） |
| `QA-PLAY` | qa-lead | 运行中的 game/ 的试玩测试 |
| `CD-CHECKPOINT` | creative-director | Checkpoint A/B/C 展示前的最终判定 |

review→revise 的最大迭代数与合格标准定义在 `.claude/docs/review-loops.md`。

## 6. 产出物路径（生成物全部位于仓库相对的以下位置）

```
design/brief.md            # 头脑风暴输出（游戏形象、约束、参考作品）
design/concept.md          # 含支柱 P-xx 的策划书
design/gdd.md              # 游戏设计文档（引用 P-xx）
design/art-bible.md        # 美术圣经（人类可读）
design/art-bible.json      # 机器可读的风格锁定（style block/palette/参考 crop/style_codes）
design/assets.md           # 资产清单（生成规格: 类别/提示词/尺寸/提供方路由）
design/refs/               # key image 候选、参考图像、crop 存放处（art-bible.json 引用）
docs/architecture.md       # 游戏架构（场景/关卡构成、系统边界）
docs/conventions.md        # 本游戏特有的代码规范
game/                      # 自包含游戏项目（内容按引擎区分 — §11）
game/assets/MANIFEST.jsonl # 生成 provenance（仅 engine=phaser。1 行 1 资产: provider/model/prompt/seed/cost_usd/sha256/license。标注条款提供方必须有 license_note — assets-config.md「Provenance」）
game/_generated/           # 原始生成资产＋MANIFEST.jsonl（仅 engine=unity/unreal — §11。因 macOS 大小写不敏感的文件系统中 game/Assets 与 game/assets 会冲突，故分离）
qa/report.md               # 试玩测试报告
qa/evidence/               # 截图、录像等证据
```

MANIFEST.jsonl 的权威路径（按引擎区分，与 §11 的表一致）:
`phaser` → `game/assets/MANIFEST.jsonl` / `unity`、`unreal` → `game/_generated/MANIFEST.jsonl`

元进度存档数据（**运行时生成物** — 不是仓库产出物。实现规范的权威来源为各 tech-stack 文档的「存档 / 持久化」节）:

| engine | 保存位置（运行时） | 格式 |
|---|---|---|
| `phaser` | `localStorage` 键 `arcaderelay-save` | JSON（首字段 `save_version` 必需） |
| `unity` | `Application.persistentDataPath/save.json` | JSON（`save_version` 必需、经 `.tmp` 的原子写入） |
| `unreal` | `USaveGame` 槽 `ForgeGameSave`（实体 `Saved/SaveGames/`） | UPROPERTY 序列化（`SaveVersion` 字段必需） |

- 存档损坏时**不得静默初始化**: 损坏 = 解析失败、`save_version` 缺失、未来版本、**schema 验证失败（必需字段缺失、类型不正）**中的任一。将原始数据备份保存到 `.bak` → 输出 1 次带 `[SaveCorruption]` 前缀的显式错误日志 → 以默认值重新生成并向 UI 层传播 `recovered` 标志（各引擎的 rules/ 强制。QA-PLAY 要点5 验证。按字段逐个填入默认值静默吞掉的实现也属违规）。
- 比 `save_version` 更新的版本的数据不做迁移，视同损坏处理（禁止隐式降级）。

## 7. 状态文件（`state/`）

```
state/stage.txt                    # 仅 §1 的 5 值之一，1 个词
state/review-mode.txt              # 仅 full | lean | solo 之一，1 个词
state/active.md                    # 会话交接（当前位置/下一步操作/未解决事项）
state/stories.yaml                 # story 一览（下述 schema）
state/reviews/<artifact>.md        # 审查历史（artifact 例: concept, gdd, art-bible, s-03, qa, batch-verify）
state/reviews/checkpoint-a.md      # CD-CHECKPOINT 历史（Checkpoint A）
state/reviews/checkpoint-b.md      # CD-CHECKPOINT 历史（Checkpoint B）
state/reviews/checkpoint-c.md      # CD-CHECKPOINT 历史（Checkpoint C）
state/checkpoint-a-feedback.md     # Checkpoint A 的人类反馈
state/checkpoint-b-feedback.md     # Checkpoint B 的人类反馈
state/session-log.txt              # 会话结束日志（hook 追加写入、仅追加）
state/budget.txt                   # 资产生成的预算上限 USD（仅数值。默认 20）
state/asset-routing.json           # preflight 结果（提供方路由表）
state/engine.txt                   # 仅 §11 的 3 值之一，1 个词。不存在则视为 phaser（向后兼容）
state/engine-info.json             # 引擎 preflight 结果（已解析的编辑器/引擎路径、版本。§11）
```

`stories.yaml` schema:

```yaml
stories:
  - id: S-01              # 稳定 ID。禁止重新分配
    title: "玩家移动"
    pillar: P-01           # 必须引用 design/concept.md 的支柱 ID
    assignee: gameplay-engineer   # §2 的 agent 名
    phase: prototype       # prototype | build
    status: todo           # todo | in-progress | review | done
    acceptance: "..."      # 可验证的验收条件
```

时刻记录规范: 写入 `state/`、`qa/` 等仓库产出物的日期时间，必须粘贴 `date -u +%Y-%m-%dT%H:%M:%SZ` 的执行输出（禁止凭推测、记忆记录时刻 — E3 中有与实际时间线偏差 5 小时的实例）。

## 8. 稳定 ID 格式

- 支柱: `P-01`～（在 design/concept.md 中定义。3～5 个。所有产出物都引用它）
- story: `S-01`～（在 state/stories.yaml 中定义）
- 资产: `IMG-01`～（图像）/ `SFX-01`～（音效）/ `BGM-01`～（音乐）/ `MDL-01`～（3D 模型。含 rig、贴图）/ `ANM-01`～（骨骼动画）（在 design/assets.md 中定义。MDL/ANM 仅在 engine=unity/unreal 时使用）
- 元进度: `ACH-01`～（成就）/ `UNL-01`～（解锁对象。角色、关卡、皮肤通用）/ `UPG-01`～（跨局升级）（在 design/gdd.md「元进度（游戏外）」节中定义。不限 engine）
- ID 禁止删除、重新分配。废止时用 status/注记表示。
- design/assets.md 的资产状态词汇（仅此5值）: `planned | generated | approved | rejected | must-replace`

## 9. review-mode 的含义（所有 skill、workflow 通用）

| mode | Checkpoint A/B/C | 产出物审查 loop |
|---|---|---|
| `full` | 停止并由人类批准 | 自动。workflow 累积所有 verdict 历史，完成后在 Checkpoint 展示时将全部内容提交给人类 |
| `lean`（默认） | 停止并由人类批准 | 自动（仅到达 MAX 时交给人类） |
| `solo` | 不停止（仅通知并继续） | 自动 |

## 10. 资产生成路由（详情见 assets-config.md）

环境变量: `FAL_KEY` `ELEVENLABS_API_KEY` `RETRO_DIFFUSION_API_KEY`（可选: `IDEOGRAM_API_KEY` `OPENAI_API_KEY` `MESHY_API_KEY` `TRIPO_API_KEY`。预算初始值: `ASSET_BUDGET_USD` → `state/budget.txt`）
3D 资产（engine=unity/unreal）: **Primary 为 Meshy**。若 `MESHY_API_KEY` 有效则**以 Meshy 直连 API 为第一候选**（Meshy 的 Free 计划不发放 API 密钥，因此密钥有效 ≒ Pro 以上 = 可商用），经 `FAL_KEY` 的 `fal-ai/meshy/*` 为第二候选（Meshy 的双路冗余 — 不制造单点故障）。仅对两者都失败的资产类别降到 Hunyuan3D/TRELLIS/Rodin/Tripo。3D 项目（engine=unity/unreal）中 `MESHY_API_KEY` 未设置视为**准必需的缺失**，由 preflight 警告并记录到 `notes` — 路由详情见 assets-config.md 的 3D 节
生成 lane **仅限调用 API 的 Bash 调用**，在开头执行 `set -a; source .env 2>/dev/null; set +a` 后再 curl（子 agent 的 shell 不继承密钥）。验证、后处理（运行 ffmpeg / npx / python 等第三方 CLI 的步骤）不 source — 避免向子进程继承全部密钥＝供应链暴露。禁止输出、记录密钥值。
preflight 结果写出到 `state/asset-routing.json`（含 `checks.*` 的实测 `plan_tier`、按路由的 `shippable`、`notes[]` — schema 权威来源为 forge skill 的 Phase 1），生成时遵循它（禁止生成中重新判定）。**用 `shippable: false` 的路由生成的资产必须作为未解决事项累积，并在 Checkpoint 展示给人类**（不得只以 MANIFEST 注记了事）。

## 11. 引擎（`state/engine.txt`、仅此 3 值）

```
phaser | unity | unreal
```

| engine | 维度 | tech-stack 权威来源 | 项目标记 | 代码规范 rule | 代码对象路径（CR-CODE） |
|---|---|---|---|---|---|
| `phaser` | 2D | `.claude/docs/tech-stack.md` | `game/package.json` | `rules/gameplay-code.md` + `rules/ui-code.md` | `game/src/**` |
| `unity` | 3D | `.claude/docs/tech-stack-unity.md` | `game/ProjectSettings/ProjectVersion.txt` | `rules/unity-code.md` | `game/Assets/Scripts/**`（.cs） |
| `unreal` | 3D | `.claude/docs/tech-stack-unreal.md` | `game/ForgeGame.uproject` | `rules/unreal-code.md` | `game/Source/**`（.cpp/.h） |

规则:

- **选择**: 在 `/forge-brainstorm` 的第一个问题（运行环境）中确定，以 1 个词保存到 `state/engine.txt`＋在 `design/brief.md` 中明确记载。之后的阶段禁止变更。
- **默认**: `state/engine.txt` 不存在则为 `phaser`（现有 2D 流水线的向后兼容。现有项目无需修改即可运行）。
- **unity/unreal 视为 3D 专用**（Unity 2D 等不在范围内。2D 使用 phaser）。
- **引擎 preflight**: 在 brainstorm 中确定引擎后，skill 验证引擎实体并写出到 `state/engine-info.json`（unity: 用 Unity Hub CLI 解析最新的已安装编辑器 / unreal: 确认 `RunUAT.sh` 实际存在）。之后的构建、QA 使用此路径（禁止执行中重新解析）。schema:

```json
{
  "engine": "unity",
  "version": "6000.3.16f1",
  "binary": "/Applications/Unity/Hub/Editor/6000.3.16f1/Unity.app/Contents/MacOS/Unity",
  "validated_at": "<ISO8601>"
}
```

（unreal 的情况: `binary` = `RunUAT.sh` 的完整路径，另外必须有 `ue_root` = `/Users/Shared/Epic Games/UE_5.x` 的引擎根目录）

- **验证命令的权威来源**: 各 tech-stack 文档的「## 验证命令」节。skill、workflow、agent 不硬编码命令，而是读取与 engine 对应的 tech-stack 文档的同一节（workflow 脚本内的定型提示词可例外地作为按引擎区分的 profile 常量持有，但内容须与 tech-stack 文档一致）。
- **生成资产的存放位置**: 原始生成物＋MANIFEST 为 phaser=`game/assets/`、unity/unreal=`game/_generated/`。引擎导入目标为 unity=`game/Assets/Resources/Generated/`（`Resources.Load` 方式。AssetKeys 的值为 Resources 相对路径 — tech-stack-unity.md「资产处理」）、unreal=`game/Content/Generated/`（导入后仍保留 raw 与 MANIFEST＝provenance 的权威来源）。
- **unreal 的项目名固定为 `ForgeGame`**（`game/ForgeGame.uproject`。为了将标记检查与构建命令机械化）。
- **引擎无关核心的边界划分**（tech-stack.md「面向未来引擎无关化的边界划分」的一般化）: 游戏逻辑放在不依赖引擎 API 的纯代码层（phaser: `game/src/systems/` / unity: `game/Assets/Scripts/Systems/`（不依赖 MonoBehaviour 的 pure C#）/ unreal: `game/Source/ForgeGame/Systems/`（不依赖 UObject 的 pure C++。但基本类型可用）），引擎依赖封闭在场景/组件层。
- **必需场景集合（所有引擎通用、所有游戏必需）**: `Boot / Title / Menu / Game / Result` 5 个状态。phaser=`BootScene/TitleScene/MenuScene/GameScene/ResultScene`、unity=`Assets/Scenes/` 的 5 个场景、unreal=`Content/Maps/` 的关卡拆分或状态转换（两者皆可。但必须使 5 个状态全部实际存在且其转换可由 Automation 测试验证 — 不允许「因为是单一关卡所以省略 Title/Menu」）。标准流程: `Boot → Title → Menu → Game → Result → { Game（重新开始） | Menu }`。Menu 的必需要素为开始游玩、游戏外显示（解锁/成就/统计）、设置（音量、操作显示）、退出入口（ui-engineer 的职责）。**Title 与 Menu 的 story 未以 `assignee: ui-engineer` 存在于 state/stories.yaml 的分解不合格**（workflow 的 Setup 机械验证并退回给 tech-director）。
- **prototype 垂直切片的必需范围包含「环境的最低限度视觉表现」**（作为 `assignee: gameplay-engineer` 的 story 发布。地面/背景的可视化、光照、相机构图的确定 — engine=phaser（2D）为背景可视化+画面布局确定即可。engine=unity/unreal 即使是占位地形也必须有可见的地面）— 为了使 Checkpoint B 的体感评估成立。对应 story 不存在于 state/stories.yaml 的分解不合格（workflow 的 Setup 机械验证）。
- **元进度（游戏外）必需**: design/gdd.md 必须有「元进度（游戏外）」节（templates/gdd.md。最高分/最佳时间+统计=所有游戏必需，从货币/解锁/成就/跨局升级中选择 2 个以上。DR-GDD 要点6 判定）。逻辑放在引擎无关核心层的子文件夹（phaser: `game/src/systems/meta/` / unity: `game/Assets/Scripts/Systems/Meta/` / unreal: `game/Source/ForgeGame/Systems/Meta/`），持久化 I/O 封闭在**持久化层**（phaser: `game/src/persistence/` / unity: `game/Assets/Scripts/Persistence/` / unreal: `game/Source/ForgeGame/Persistence/` — 唯一允许 UObject/MonoBehaviour/浏览器 API 的 I/O 层）。存档规范见 §6。
