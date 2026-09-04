---
name: forge
description: ArcadeRelay 主入口。依次执行 preflight → 头脑风暴 → concept / prototype / build 三个自主阶段，用一条提示词直达可玩的游戏成品（phaser 2D / unity 3D / unreal 3D — state/engine.txt）。读取 state/stage.txt 即可从中途幂等恢复。
---

Codex invocation: `$forge`.

# /forge — 主入口（一条提示词直达成品）

命名、ID、路径以 `.codex/docs/contract.md` 为单一事实来源。不要自创其中没有的名称。
状态以文件为真实（`state/`）。每个 Phase 完成时更新 `state/active.md`（当前位置/下一步操作/未解决事项）。

## Phase 0: 前提确认与恢复位置决定（幂等）

1. 读取 `state/stage.txt`（不存在则视为「未开始」）。若存在 `state/active.md` 则读取，掌握上次的未解决事项。
2. 按下表决定恢复位置。stage 值表示已完成的阶段（contract.md §1）:

| state/stage.txt | 含义 | 恢复位置 |
|---|---|---|
| （不存在/为空） | 未开始 | 从 Phase 1 开始 |
| `brief` | 头脑风暴完成 | Phase 1（仅当 `state/asset-routing.json` 不存在时）→ Phase 3 |
| `concept` | Checkpoint A 已批准 | Phase 4 |
| `prototype` | Checkpoint B 已通过 | Phase 5 |
| `build` | Checkpoint C 已到达（可能尚未验收） | Phase 5（重新执行 `/forge-build`。forge-build 的 Phase 0 会检测到 build/done，并从验收确认处恢复） |
| `done` | 交付完成 | 重新展示 Phase 6 的最终报告后结束 |

3. 矛盾检测: 若 stage 值对应的产出物（`.codex/docs/pipeline.yaml` 的 `artifacts.required`）缺失，则回退到生成该产出物的阶段重新执行（例: stage=`concept` 但 `design/gdd.md` 不存在 → 从 Phase 3 开始）。不要改写 stage.txt，交由阶段完成时以正确值覆盖。

## Phase 1: preflight（密钥验证、路由决定、状态初始化）

若 `state/asset-routing.json` 已存在则**跳过本 Phase**（禁止在生成中重新判定路由 — contract.md §10）。**但若现有文件中没有 `shippable` 键（旧 schema），则不跳过而重新生成**（若生成 lane 参照旧格式，所有路由实际上都会被视为可发布）。

1. 读取 `.env`（不存在则提示从 `.env.example` 复制）。目标密钥: `FAL_KEY` `ELEVENLABS_API_KEY` `RETRO_DIFFUSION_API_KEY` `MESHY_API_KEY`（**3D 项目中准必需** — Meshy 直连 API 是 3D Primary。未设置也不停止，但要发出警告，并在 notes 中记录已将第一候选降为经 fal 的 Meshy — contract §10）（可选: `IDEOGRAM_API_KEY` `OPENAI_API_KEY` `TRIPO_API_KEY`。`OPENAI_BASE_URL` 为 OpenAI 兼容中转的基址，未设置时为 `https://api.openai.com/v1`；`checks.openai.base_url` 原样记录实际使用的基址，非官方基址时 `plan_tier: "relay"` 并在 notes 记录「经第三方中转，计费/配额由中转方决定」）。预算: 若有 `ASSET_BUDGET_USD` 则用作 `state/budget.txt` 的初始值（步骤6）。
2. 对每个存在的密钥 ping 余额/认证:

```bash
set -a; source .env 2>/dev/null; set +a

# fal — GET 认证确认（查询不存在的 request id，仅验证认证层。401/403=密钥无效，404 等=认证 OK）
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Key $FAL_KEY" \
  "https://queue.fal.run/fal-ai/flux-2-pro/requests/00000000-0000-0000-0000-000000000000/status"

# Retro Diffusion — 点数余额（{"credits": N}。N=0 则警告）
curl -s -H "X-RD-Token: $RETRO_DIFFUSION_API_KEY" \
  "https://api.retrodiffusion.ai/v1/inferences/credits"

# ElevenLabs — 套餐记录（读取 .tier 写入 plan_tier。free 也允许发布 — assets-config.md 硬性禁止事项节。密钥缺 user_read 权限时记 "unknown"）
curl -s -H "xi-api-key: $ELEVENLABS_API_KEY" \
  "https://api.elevenlabs.io/v1/user/subscription" | jq '{tier, character_count, character_limit}'

# Ideogram（可选密钥。仅在已设置时）— 仅验证认证层（401/403=密钥无效，其他=认证 OK）
[ -n "$IDEOGRAM_API_KEY" ] && curl -s -o /dev/null -w "%{http_code}" \
  -H "Api-Key: $IDEOGRAM_API_KEY" "https://api.ideogram.ai/v1/ideogram-v3/generate"

# OpenAI 或 OpenAI 兼容中转（可选密钥。仅在已设置时）— 认证确认（200=有效，401=密钥无效）。
# 基址取 OPENAI_BASE_URL（默认 https://api.openai.com/v1。第三方中转如 packcode 时填其 /v1 基址）。
# 200 后再确认 models 列表含 gpt-image-2（中转可能只代理部分模型 — 不含则视为 openai 路由无效并记录到 notes）
[ -n "$OPENAI_API_KEY" ] && curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $OPENAI_API_KEY" "${OPENAI_BASE_URL:-https://api.openai.com/v1}/models"
[ -n "$OPENAI_API_KEY" ] && curl -s -H "Authorization: Bearer $OPENAI_API_KEY" "${OPENAI_BASE_URL:-https://api.openai.com/v1}/models" \
  | jq -r '.data[].id' | grep -qx "gpt-image-2" && echo "gpt-image-2: available" || echo "gpt-image-2: MISSING"

# Meshy 直连 API（3D 项目中准必需）— 通过获取余额验证认证（docs.meshy.ai/en/api/balance）
# **仅 200 为有效**（plan_tier="pro+" — Free 无密钥发放的间接证明。balance 响应中没有 tier 字段）。
# 401/403=密钥无效。**其他（5xx/429/timeout=000）=无法验证** — 任何非 200 都将 routes.model_*/anim
# 降为 fal:meshy-*，并把 plan_tier="unknown" 及原因记录到 notes（不给未验证的密钥标 pro+）
[ -n "$MESHY_API_KEY" ] && curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $MESHY_API_KEY" "https://api.meshy.ai/openapi/v1/balance"

# Tripo 直连 API（可选密钥）— 通过余额端点验证认证（端点格式未验证 — 非 200 时
# 记为「无法验证」写入 notes，不从 fallbacks 中排除。仅 401/403 视为无效并排除路由）
[ -n "$TRIPO_API_KEY" ] && curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TRIPO_API_KEY" "https://api.tripo3d.ai/v2/openapi/user/balance"
```

3. **套餐层级判定**: ElevenLabs 的 `tier` 原样转录为 `plan_tier`（`free` 也允许发布 — `shippable: true`，仅在 notes 记录「ElevenLabs Free 计划，官方条款为非商用，项目决策允许发布」并在 Checkpoint 许可标记中披露。assets-config.md 硬性禁止事项节）。Meshy 在 balance 200 时为 `plan_tier: "pro+"`（Free 无密钥发放 = 间接证明。assets-config.md 3D 节）。无法实测的提供方设为 `plan_tier: "unknown"`，并在 notes 中记录「无法验证」（在 Checkpoint 中披露）。
4. 将路由决定写出到 `state/asset-routing.json`。路由按 `.codex/docs/assets-config.md` 的路由表（2D 表＋3D 表），根据密钥有无与验证结果，按 Primary → 第二候选 → Fallback → 本地降级 的顺序决定。**3D 路由（model_* / anim）即使 engine 未确定也始终写出**（因为 preflight 在 brief 确定前运行。engine=phaser 时只是不被使用）。**3D 的 Primary 是 Meshy**: `MESHY_API_KEY` 有效则为 `meshy:direct`，无效/未设置则将 `fal:meshy-*` 提升为第一候选，并把此事（以及 3D 项目中的准必需警告）记录到 notes（contract §10）。可选密钥（IDEOGRAM / OPENAI / TRIPO）若认证 ping 无效（401/403），则从 `fallbacks` 中排除对应路由并在 `notes` 中记录原因（Tripo 的 ping 若为 401/403 以外的未知响应则不排除，记录为「无法验证」）:

   **`image_sprite` / `image_background` 的 Primary 二选一**（assets-config.md「图像 Primary 二选一」。fal.ai 不再是强制项）: `FAL_KEY` 有效且 `OPENAI_API_KEY` 无效/未设置 → Primary=`fal:*`（既有行为）。`FAL_KEY` 无效/未设置且 `OPENAI_API_KEY` 有效 → Primary=`openai:gpt-image-2`。两者都有效 → 用 Codex 对话询问 让用户一次性选定，把选择与理由记到 `notes`（此后阶段禁止重新询问 — 与「禁止在生成中重新判定路由」同规则）。两者都无效/未设置 → 按 Fallback 列继续（Ideogram 直连 → 本地降级）。**Primary=`openai:gpt-image-2` 且 `FAL_KEY` 无效时的连带影响**: `routes.bg_removal` 降为 `local:rembg-isnet-anime`（无 OpenAI 替代），FLUX LoRA 训练（assets-config.md 风格一致性协议 3）不可用 — 两点都记录到 `notes`。

```json
{
  "generated_at": "<ISO8601>",
  "checks": {
    "fal":             {"key": true,  "auth": "ok",  "plan_tier": "prepaid"},
    "elevenlabs":      {"key": true,  "tier": "starter", "plan_tier": "starter", "commercial_ok": true},
    "retro_diffusion": {"key": false, "credits": null, "plan_tier": "unknown"},
    "ideogram":        {"key": false, "plan_tier": "unknown"},
    "openai":          {"key": false, "plan_tier": "unknown", "base_url": "https://api.openai.com/v1"},
    "meshy":           {"key": true,  "auth": "ok",  "plan_tier": "pro+", "note": "balance 200 = 密钥有效 ≒ Pro 以上（Free 无密钥发放）"},
    "tripo":           {"key": false, "plan_tier": "unknown"}
  },
  "routes": {
    "image_sprite":     "fal:ideogram-v3-transparent",
    "image_background": "fal:flux-2-pro",
    "pixel_art":        "local:nearest-neighbor",
    "bg_removal":       "fal:birefnet-v2",
    "sfx":              "elevenlabs:sfx-v2",
    "bgm":              "elevenlabs:music-v2",
    "model_character":  "meshy:direct-image-to-3d+rigging",
    "model_prop":       "meshy:direct-image-to-3d",
    "model_environment":"meshy:direct-image-to-3d",
    "anim":             "meshy:direct-animation"
  },
  "shippable": {
    "image_sprite": true, "image_background": true, "pixel_art": false, "bg_removal": true,
    "sfx": true, "bgm": true,
    "model_character": true, "model_prop": true, "model_environment": true, "anim": true
  },
  "fallbacks": {
    "image_sprite":    ["ideogram:direct", "openai:gpt-image-2"],
    "sfx":             ["local:jsfxr"],
    "bgm":             ["local:stable-audio-open-small"],
    "model_character": ["fal:meshy-v6-image-to-3d+rigging", "tripo:direct", "local:blender-procedural-rigify"],
    "model_prop":      ["fal:meshy-v6-image-to-3d", "fal:hunyuan3d-v2", "fal:trellis", "fal:hyper3d-rodin", "local:blender-procedural"],
    "model_environment": ["fal:meshy-v6-image-to-3d", "fal:hunyuan3d-v2", "fal:trellis", "fal:hyper3d-rodin", "local:blender-procedural"],
    "anim":            ["fal:meshy-rigging-multi-animation", "local:code-motion"]
  },
  "degraded": false,
  "notes": ["无 RETRO_DIFFUSION_API_KEY: 像素美术项目采用本地降级（nearest-neighbor 缩小+调色板量化）",
            "meshy 直连 API 的 rigging/animation 端点所需套餐层级未验证（403 时按资产类型切换到经 fal 路由，并记录到未解决事项 — assets-config.md 3D 节）"]
}
```

- `shippable` 为按路由的可发布与否（本地降级（jsfxr 除外）/ 非商用许可路径为 `false`。ElevenLabs 任何 tier 均为 `true`）。**`routes` 的所有键必须也包含在 `shippable` 中**（不要产生查询后为 undefined 的键。上例的 `pixel_art: false` 是本地降级时的值 — Retro Diffusion 有效时为 `true`）。**生成 lane 用 `shippable: false` 的路由生成的资产必须累积到未解决事项，并在 Checkpoint 向人类展示**（contract §10）。
- `MESHY_API_KEY` 无效/未设置时: `routes.model_*` / `routes.anim` 降为 `fal:meshy-*`，并从 fallbacks 开头移除 fal:meshy 后前移补齐。若也没有 FAL_KEY，3D 路由降级为 `local:blender-procedural-rigify`（Blender 实体确认: `which blender` 或 `/Applications/Blender.app`。不存在则为 `local:engine-primitives`），并在 notes 中记录 `shippable: false`、所有生成物均为 `must_replace: true`。

5. **密钥缺失/无效时**（图像: `FAL_KEY` **与** `OPENAI_API_KEY` 两者都失效/未设置 — 只要其中一个有效，图像 Primary 已在步骤4确定，**不触发本项**；或 `ELEVENLABS_API_KEY` 缺失/认证 401 时。**ElevenLabs Free 计划不触发本项**），用 Codex 对话询问 让用户选择:
   - 「设置密钥后中断」— 从 `.env.example` 展示对应密钥的获取 URL 与步骤（图像二选一: fal: https://fal.ai/dashboard/keys 或 OpenAI: https://platform.openai.com/api-keys / ElevenLabs: 任意计划的 API Key），指引用户设置后重新执行 `/forge`，然后结束。
   - 「以本地降级模式继续」— 将对应 routes 设为降级序列（图像: mflux/ComfyUI FLUX schnell + rembg、SFX: jsfxr、BGM: Stable Audio Open Small），在 `notes` 中记录 `"degraded": true` 及质量影响后继续。
   - 仅缺 `RETRO_DIFFUSION_API_KEY` 时不中断（记录到 notes，仅当成为像素美术项目时才降级）。
6. 状态初始化（不覆盖现有文件＝幂等）:

```bash
mkdir -p state
[ -s state/budget.txt ]      || echo "${ASSET_BUDGET_USD:-20}" > state/budget.txt
[ -s state/review-mode.txt ] || echo "lean" > state/review-mode.txt
```

## Phase 2: 头脑风暴（唯一的对话阶段）

1. 用 Codex 技能启动 `forge-brainstorm`。若有 `$ARGUMENTS`（用户的初始想法），原样作为 args 传入。
2. 完成验证: `design/brief.md` 存在、`state/stage.txt` 为 `brief`、`state/engine.txt` 为 contract §11 三值之一。若不满足，则在确认产出物存在后写入 `brief`；engine.txt 不存在时从 brief 的运行环境章节恢复（自我修复）。**若从 brief 也无法恢复，不要静默退回 phaser**，而是用 Codex 对话询问 确认引擎后再写入（引擎是此后禁止更改的最重要分支 — contract §11）。

## Phase 2.5: 引擎 preflight（仅 engine=unity/unreal。幂等）

若 `state/engine.txt` 为 `phaser`（或不存在）则跳过。若 `state/engine-info.json` 已存在且 binary 实际存在则跳过。

1. **unity**: 用 Unity Hub CLI 解析已安装的编辑器:

```bash
"/Applications/Unity Hub.app/Contents/MacOS/Unity Hub" -- --headless editors --installed
```

   选择 `6000.` 系的最新版（版本降序的首个），按 contract §11 的 schema 写出到 `state/engine-info.json`（engine / version / binary / validated_at）。**若 6000. 系一个也没有，即使有其他版本（2022 系等）也按「没有」处理**（不要静默选择不支持的编辑器）。包括 Hub 本身不存在（命令无法执行）的情况，没有时用 Codex 对话询问:
   - 「用 Unity Hub 安装编辑器后重新执行」— 展示 Hub CLI 的安装命令示例（`-- --headless install --version <6000.x LTS>`。Hub 不存在则从 `brew install --cask unity-hub` 开始）后停止
   - 「切换到 phaser」— 将 `state/engine.txt` 改写为 `phaser`，同时更新 brief 的运行环境章节后继续
2. **unreal**: 用 `ls "/Users/Shared/Epic Games/UE_"*/Engine/Build/BatchFiles/RunUAT.sh` 确认实际存在，将最新版本写出到 `state/engine-info.json`（`binary` = RunUAT.sh 的完整路径、`ue_root` = `/Users/Shared/Epic Games/UE_5.x` 的引擎根目录）。**同时用 `df -g /` 检查磁盘剩余空间，不足 20GB 时警告 cook/打包失败风险**（tech-stack-unreal.md「引擎安装」）。引擎不存在时用 Codex 对话询问:
   - 「安装引擎后重新执行」— 展示安装步骤（tech-stack-unreal.md「引擎安装」: 登录 dev.epicgames.com/portal → 下载 .pkg → `sudo installer -pkg ... -target /`。**需要一次浏览器登录**、磁盘剩余空间建议至少 100GB）后停止
   - 「切换到 unity / phaser」— 更新 engine.txt 与 brief 后继续
3. 写出后，构建类命令此后使用 `state/engine-info.json` 的 binary（禁止运行中重新解析 — contract §11）。

## Phase 3～5 共通: 自主阶段的推进规则

- 各 skill 在自身的 Checkpoint 停止（review-mode 为 `full`/`lean` 时 — contract.md §9）。**批准后控制权返回，因此要确认 `state/stage.txt` 已前进后再进入下一个 Phase**。未前进时（REJECT、中断）将情况记录到 `state/active.md`，用 Codex 通知 通知后停止（下次 `/forge` 时恢复）。
- `state/review-mode.txt` 为 `solo` 时: **不在 Checkpoint 停止**。阶段完成通知统一由各子 skill（forge-concept / forge-prototype / forge-build 在展示 Checkpoint 时发送的 Codex 通知）负责，**/forge 自身不发送阶段完成通知**（仅当子 skill 无法发送通知而失败/错误停止时，才由 /forge 通知）。连续执行。
- 子 skill/workflow 因错误返回时同样记录 active.md + Codex 通知 + 停止。

## Phase 3: 策划与设计（Checkpoint A）

用 Codex 技能启动 `forge-concept`。完成条件: `design/concept.md` `design/gdd.md` `design/art-bible.md` `design/art-bible.json` `design/assets.md` 齐备，stage 前进到 `concept`。

## Phase 4: 原型（Checkpoint B）

用 Codex 技能启动 `forge-prototype`。完成条件: `docs/architecture.md` `docs/conventions.md` `state/stories.yaml` `qa/report.md` 及引擎的项目标记（contract §11: phaser=`game/package.json` / unity=`game/ProjectSettings/ProjectVersion.txt` / unreal=`game/ForgeGame.uproject`）齐备，stage 前进到 `prototype`（留下 `state/checkpoint-b-feedback.md`）。

## Phase 5: 正式实现与打磨（Checkpoint C）

用 Codex 技能启动 `forge-build`。完成条件: 完整 QA 合格（`qa/report.md` 已更新、引擎别权威路径的 MANIFEST.jsonl 存在 — contract §6），stage 前进到 `build` **或 `done`**（forge-build 进行到验收确认与完成处理时会写入 `done`）。若 stage 仍为 `build` 且 forge-build 给出了停止指引（修改请求、中断），则不进入 Phase 6，按共通规则记录 active.md 并停止（下次 `/forge` 从 Phase 5 恢复）。

## Phase 6: 完成与最终报告

前提: stage 为 `done`（forge-build 已完成 Checkpoint C 展示、验收确认、`done` 写入）。与 forge-build 的 Checkpoint C 重复的展示 — `qa/report.md` 的 Codex 文件附件、Codex 通知、写入 `state/stage.txt` — **不重复执行**。此处仅做最终摘要的复述与补充。

1. 成本汇总与预算核对（MANIFEST 路径按引擎区分 — contract §6。以下 `$MANIFEST` = phaser: `game/assets/MANIFEST.jsonl` / unity、unreal: `game/_generated/MANIFEST.jsonl`）:

```bash
jq -s 'map(.cost_usd // 0) | add' "$MANIFEST"   # 实际合计 USD
cat state/budget.txt                             # 预算上限
```

2. 提取许可标记:

```bash
jq -c 'select(.license != "commercial-ok" or .must_replace == true)' "$MANIFEST"
```

   在此基础上加上 assets-config.md 的固定标记（ElevenLabs「Studio Games」条款 / Ideogram 应用内 AI 生成标注条款 / 美国纯 AI 输出著作权的不确定性→MANIFEST 中的人类参与记录是防御材料。使用 3D 时: Hunyuan3D 的 Territory 排除 / Meshy、Tripo 的套餐条件 / unreal 则为 UE EULA 的生成式 AI 输入禁止条款）一并列举。
3. 组装并展示最终报告:
   - **游玩方法**（按引擎 — 各 tech-stack 文档「验证命令」的 dev/preview 行）: phaser: `cd game && npm install && npm run dev` / unity: `open game/Build/ForgeGame.app`（或在编辑器中打开 game/）/ unreal: `open game/Build/Mac/ForgeGame.app`。操作方法、胜利/失败条件从 `design/gdd.md` 摘要。
   - **QA 结果**: `qa/report.md` 的摘要（重大 bug 0、acceptance 通过情况）。
   - **成本**: MANIFEST 合计 vs `state/budget.txt`。
   - **许可标记**: 步骤2 的列举 + 若有 `must_replace` 资产则给出替换指示。
   - **未解决事项**: `state/reviews/` 中到达 MAX_ITER 仍非 APPROVE 的问题一览。
4. 将 `state/active.md` 更新为「交付完成」（forge-build 已更新则仅追加写入差异。`state/stage.txt` 已由 forge-build 写入，不要触碰）。
