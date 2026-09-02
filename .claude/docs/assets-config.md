# ArcadeRelay 资产生成配置（2026-07 调研、已经官方文档验证）

> art-director / audio-designer 与 workflow 脚本按本表生成。
> preflight（/forge 开头）验证密钥、余额、套餐等级，并把结果写出到 `state/asset-routing.json`（含 `plan_tier`/`shippable`/`notes[]` — schema 权威来源是 forge skill Phase 1）。
> **禁止在生成过程中重新判定路由**（路由表就是事实）。
> **生成 lane 仅限调用 API 的 Bash 调用，在开头执行 `set -a; source .env 2>/dev/null; set +a` 后再 curl**（子 agent 的 shell 不会继承密钥）。验证、后处理（ffmpeg / npx / python 等）不要 source — 避免把全部密钥继承给第三方子进程（contract §10）。禁止 echo、记录密钥值或写入 MANIFEST。

## 路由表

| 资产类型 | Primary | Fallback | 无密钥本地降级 |
|---|---|---|---|
| 图像: 精灵/角色/UI | fal.ai `fal-ai/ideogram/v3/generate-transparent`（生成时原生透明、seed、style_codes、character_reference） | Ideogram V3 官方 REST 直连（`api.ideogram.ai/v1/ideogram-v3/generate`。seed/style_codes 兼容） → 第三: 将 OpenAI `gpt-image-1.5` **pin 住**（`background:"transparent"`。**gpt-image-2 因透明报错禁止使用**） | mflux 或 ComfyUI + FLUX **schnell/klein**（Apache-2.0＝可商用）+ rembg |
| 图像: 背景/图块集 | fal.ai `fal-ai/flux-2-pro`（8 张参考图 + hex 调色板严格指定） | 同上 | 同上 |
| 像素画项目（替换全部图像） | Retro Diffusion `api.retrodiffusion.ai`（RD_FAST/RD_PLUS、RD_TILE=`tile_x/tile_y`、RD_ANIMATION=`return_spritesheet:true`、`remove_bg:true`、**用 `check_cost:true` 在调用前做预算 gate**） | PixelLab hosted MCP（注意: text mode 64x64/4 帧等实际限制） | nearest-neighbor 缩小 + 调色板量化 |
| 背景去除 | fal.ai `fal-ai/birefnet/v2` | 本地 `rembg -m isnet-anime` | 同左 |
| SFX | ElevenLabs SFX v2: `POST /v1/sound-generation`（model `eleven_text_to_sound_v2`、**显式指定 `duration_seconds`**=比自动便宜 5 倍、0.5～30s，循环素材用 `loop:true`） | —（仅重试） | **jsfxr**（公有领域、确定性、可发布） |
| BGM | Eleven Music: `POST /v1/music`（model `music_v2`、用 `composition_plan` 指定段落长度、`force_instrumental:true`、seed。$0.15/分钟） | 本地 Stable Audio Open Small（Community License: 营收 $1M 以下可商用） | 同左（不行则 jsfxr 环境音 + must-replace 标记） |

## 3D 路由表（仅 engine=unity/unreal。MDL/ANM 资产）

> **fallback 全段尝试的义务**: Primary 的 API 失败时，禁止连 1 段 fallback 都不尝试就直接本地降级/占位符/must-replace 化。必须按路由表从上到下全段尝试 fallback，并务必记录、报告每次尝试的「路由名 + HTTP 状态（或失败原因）」（仅在全段失败时才允许本地降级 — retro-e3 问题7）。

2D 表中的图像行在 3D 引擎中同样用于 UI、纹理、概念图。3D 模型/动画**全行以 Meshy 为 Primary**（contract §10）— `MESHY_API_KEY` 有效时直连 API 为第一候选，无效/未设置时把经 `FAL_KEY` 的 fal 托管版 Meshy 提升为第一候选（Meshy 的双路冗余）:

| 资产类型 | Primary（Meshy 直连 API、密钥有效时） | 第二候选（Meshy 双路冗余: 经 fal） | Fallback（仅 Meshy 全部失败时） | 无密钥本地降级 |
|---|---|---|---|---|
| 角色（带 rig+动画、人形） | Meshy 直连 `POST /openapi/v1/image-to-3d`（PBR、GLB/FBX、异步 task）→ rigging/animation API（docs.meshy.ai/en/api/rigging-and-animation。**Pro 是否解锁尚未验证** — 403/权限错误时仅此资产类型切换到第二候选，并把切换记录到 notes/未解决事项） | fal.ai `fal-ai/meshy/v6/image-to-3d`（$0.80/次生成。单个动画即可满足时可在同一调用中包含 `enable_rigging`+`animation_action_id` 一次完成）→ 多个剪辑用 `fal-ai/meshy/rigging/multi-animation`（$0.20/请求 + $0.12/剪辑、最多 10。+Z 前方、300k 面上限） | Tripo 直连 API（`TRIPO_API_KEY`。基于 UniRig、支持非人形） | Blender headless 程序化（基元组合 blockout + **Rigify**（Blender 自带、GPL，生成的 rig 输出不受限）生成标准人形骨骼）。没有 Blender 则引擎内基元组合＋代码驱动动作。均需 `must_replace: true` |
| 角色（非人形/生物） | Meshy 直连 image-to-3d（rig 方面 Tripo 直连支持的形态更广） | fal.ai Meshy 系 | Tripo 直连 API（Quadruped/Avian/Serpentine 等） | 同上（四足则用盒子+圆柱 blockout） |
| 道具（小物件） | Meshy 直连 image-to-3d | fal.ai `fal-ai/meshy/v6/image-to-3d` | fal.ai `fal-ai/hunyuan3d/v2`（$0.16～）→ TRELLIS 系 → `fal-ai/hyper3d/rodin` | Blender 基元组合或引擎内基元。`must_replace: true` |
| 环境、地形 | Meshy 直连 image-to-3d（概念图→image-to-3D） | fal.ai Meshy 系 | fal.ai Hunyuan3D/TRELLIS 系 → `fal-ai/hyper3d/rodin` | Blender 程序化地形（Displace+噪声）或引擎内 Terrain。`must_replace: true` |
| 追加的骨骼动画（ANM） | Meshy 直连 Animation API（对已有 rig 的模型） | fal.ai `fal-ai/meshy/rigging/multi-animation`（指定 action_id） | — | 代码程序化动作（上下浮动/旋转/弹跳）。`must_replace: true` |

- **Meshy 直连 API 已核实的事实（2026-07、官方文档）**: base URL `https://api.meshy.ai`，认证 `Authorization: Bearer $MESHY_API_KEY`，余额 `GET /openapi/v1/balance` → `{"balance": N}`（200=密钥有效。响应中没有 plan/tier 字段）。POST 系返回 task id、为异步 — 轮询 task 的 GET 等待完成。**Meshy Free 套餐本身不发放 API 密钥**（API 仅 Pro=$20/mo 以上可用），因此密钥有效 ≒ Pro 以上（可商用）的间接证明。出处: docs.meshy.ai/en/api/{quick-start,image-to-3d,rigging-and-animation,balance,authentication,pricing} / help.meshy.ai
- **未验证事项（生成时按 feature-flag 处理、在 Checkpoint 披露）**: (1) 直连 API 的 rigging/animation 是否在 Pro 解锁（可能需要 Studio 以上 → 403 时按资产类型单位自动切换到 fal 经由＋记录）(2) 直连 API 积分的 USD 换算（按保守估算 $0.02/credit 记录到 MANIFEST 的 `cost_usd`，并务必附上 `"cost_estimated": true`）(3) fal 托管版 Meshy 输出的商用许可继承（fal 模型页面仅确认到 Commercial use 可用的徽章 → 在许可标记节披露）
- **实际成本（经 fal、模型页面实测 2026-07）**: image-to-3d $0.80/次生成（flat），rigging/multi-animation $0.20 + $0.12/剪辑（例: 3 个剪辑 = $0.56）。**主角 1 体（模型+rig+idle/walk/run）≈ $1.36**。Hunyuan3D v2 $0.16～。预算估算（design/assets.md「汇总与预算」）按此实际值进行
- 输出格式: **静态 = GLB / 带 rig、动画 = FBX**（与 Unity Humanoid、UE Interchange 的兼容性最稳定）。导入目标按引擎区分（contract §11）
- 本地降级（Blender）实现笔记: 骨骼采用 Unity HumanBodyBones 兼容命名（Hips/Spine/Chest/Head/LeftUpperArm…）可使 Avatar 自动映射稳定。Blender 4.4+ 为分层 Action API（`action.layers[].strips[].channelbags[].fcurves`）— 旧 `Action.fcurves` 已废弃
- **禁止 Mixamo 自动化**（Adobe ToS 明确禁止后端访问、抓取。仅允许手动下载，因此 harness 不使用）
- 开放模型的本地运行（TRELLIS/Hunyuan3D 在 Apple Silicon 上的运行）依赖非官方 fork，**不纳入路由**（无法保证可靠运行）

## 硬性禁止事项（许可/质量守卫）

- **禁止在 ElevenLabs Free 套餐下进行发布用生成**（非商用许可）。preflight 调用 subscription API **验证 Starter($6/mo) 以上**
- **禁止经 ElevenLabs 官方 MCP 生成 SFX**（5 秒上限的 bug 级限制）。必须 REST 直连
- **禁止 gpt-image-2**（透明背景已废止）。OpenAI 路由固定为 gpt-image-1.5
- **禁止 rembg 的 `bria-rmbg` 模型**（CC 非商用）。允许: isnet-anime / birefnet-* / u2net
- **禁止发布 MusicGen / AudioGen（audiocraft）的输出**（CC-BY-NC 权重）。仅用于占位符，MANIFEST 中必须记录 `"license":"placeholder-nc","must_replace":true`
- **禁止发布白底 PNG** — 精灵全部做 alpha 通道机器验证
- **（3D）禁止发布 Meshy/Tripo Free 套餐输出**（CC BY 4.0 = 必须署名、Tripo Free 不可商用。仅 Pro 以上）
- **（3D）Hunyuan3D 输出禁止面向 EU、英国、韩国发布**（Tencent Community License 的 Territory 排除）。预计超过 100 万 MAU 时必须向 Tencent 书面申请。相关资产在 MANIFEST 的 `license` 中记录 `tencent-community` 并在 Checkpoint 披露
- **（3D）禁止 Mixamo 的后端自动化、API 式访问**（违反 Adobe ToS）
- **（3D）禁止发布 gltf-validator 报错的 GLB**（全部 GLB 机器验证）

## 风格一致性协议

1. 在 Checkpoint A 由人类批准 1 张 key image → 导出 `design/art-bible.json`:
   ```json
   {
     "style_block": "前置于全部图像提示词的固定风格描述",
     "palette": ["#RRGGBB", "..."],
     "style_codes": ["ideogram 的 style code"],
     "reference_images": ["design/refs/crop-01.png", "..."],
     "character_reference": "design/refs/hero.png",
     "resolution": {"sprite": 512, "tile": 64}
   }
   ```
2. 全部图像生成机械地前置 `style_block` + 记录 seed。hero 在全部姿势中共用 `character_reference`
3. 资产超过 50 个时在 fal 训练 1 次 FLUX LoRA（$2、附商用权），之后 pin 住 LoRA id
4. 音乐使用固定流派/BPM/调性的 style block + seed。SFX 无 seed → 用共通词汇生成 4 个变体→选出最佳

## 生成后流水线（全段本地）

图像: 立即下载（fal URL≈10 分钟、Ideogram≈24h 失效）→ alpha 验证 →（必要时）背景去除 → 裁切 → 图块做偏移叠加的接缝检查 → 用 `free-tex-packer-cli` 生成 Phaser atlas JSON（仅 phaser。unity/unreal 交给引擎侧的纹理/精灵机制）
音频: `ffmpeg loudnorm`（-16 LUFS）+ 静音裁切 → BGM 做**循环验证**（小节边界交叉淡化→拼接 2 次后扫描接缝的爆音/RMS 阶差。失败则重新生成）→ 输出格式按引擎区分（phaser: OGG Vorbis 128-160kbps + M4A/AAC（Safari）/ unity: OGG / unreal: WAV）
3D 模型（MDL/ANM）: 立即下载 → **schema 验证**（GLB: 用 `npx @gltf-transform/cli validate <file>.glb` 确认错误为 0。兼容 Khronos validator。机器可读的保存以 `--format md` + 文本匹配 "No errors" 较为现实 — 没有 JSON 输出。**FBX: 用 Blender headless import → GLB export → 通过同样的 validate** — 无法转换、有错误即不合格。不得放 FBX 直接通过）→ 用 Blender headless 检查多边形数、骨骼数、材质数、非流形 → **authoring-time 尺寸测量**（第一信息源。实施步骤: (a) 如果提供商 API 响应中有尺寸/bbox，则转录到 MANIFEST 的 `bbox_authoring_m`，没有则 (b) 用 Blender headless 测量 `obj.dimensions` 并把 `bbox_authoring_m: [x,y,z]`（m 单位）记录到 MANIFEST。**Integrate 前必须完成** — FBX 的 leaf bone 的 tail 在 roundtrip 中无法复现，因此 reimport 测量仅限用于结构检查＝拓扑、骨骼名、剪辑有无）（以 1 unit 为基准，人形相当于 1.6–2.0m。注意 glTF=m / UE=cm 的换算）→ 多边形预算检查（hero ≤ 50k tri / prop ≤ 10k tri / 环境 ≤ 100k tri。超出则用 `gltfpack -si` 自动 decimate）→ 引擎导入（unity: 复制到 Assets/Resources/Generated/ / unreal: 用 Interchange Python 导入）→ 导入后把引擎内包围盒与 `bbox_authoring_m` 核对再验证

## Provenance（必需）

全部生成追加写入 MANIFEST.jsonl（权威路径按引擎区分 — contract §6: phaser=`game/assets/MANIFEST.jsonl` / unity、unreal=`game/_generated/MANIFEST.jsonl`），1 行 1 资产:

```json
{"file":"assets/sprites/hero.png","provider":"fal:ideogram-v3-transparent","model":"ideogram-v3","prompt":"...","seed":12345,"style_codes":["..."],"cost_usd":0.06,"plan_tier":"prepaid","sha256":"...","license":"commercial-ok","license_note":"ideogram-in-app-ai-disclosure","generated_at":"ISO8601"}
```

3D 资产（MDL/ANM）必须附加字段:

```json
{"file":"_generated/models/model-hero.fbx","kind":"character_rigged","provider":"meshy:image-to-3d+rigging","model":"meshy-6","prompt":"...","seed":12345,"format":["glb","fbx"],"polycount":24800,"bone_count":52,"rigged":true,"rig_type":"humanoid","animations":["idle","walk","run"],"texture_resolution":2048,"pbr":true,"units":"meters","up_axis":"+Y","bbox_authoring_m":[0.9,1.8,0.5],"cost_usd":1.36,"cost_estimated":false,"plan_tier":"pro","sha256":"...","license":"commercial-ok","validator":{"gltf_validator":"pass","non_manifold_verts":0,"bind_pose_check":"pass"},"generated_at":"ISO8601"}
```

- `kind`: `character_rigged | prop | environment | animation_only`（2D 资产可省略）
- `rig_type`: `humanoid | quadruped | other | none`
- `validator`: 原样嵌入机器验证结果（Checkpoint 展示时原样呈现）
- `bbox_authoring_m`: authoring-time 测量尺寸 [x,y,z]（m 单位。3D 资产必需 — 参见生成后流水线。AR-ASSET 的尺度要点以此值为第一信息源）
- `plan_tier`: 原样转录 preflight 的实测值（`state/asset-routing.json` 的 `checks.<provider>.plan_tier`）。`cost_estimated: true` 表示积分→USD 换算是未验证的估算

- `license_note`: 有提供商特定标注、条款义务的资产**必须转录**（Ideogram 的应用内 AI 生成标注条款 / Hunyuan3D 的 Territory 排除 / ElevenLabs「Studio Games」条款等 — 下文「许可标记」节的对应项目）。无条款提供商可省略。防止 E2 中 Ideogram 标注条款只做了口头披露、MANIFEST 未记录就完成全程的再发（retro-e2 问题9）
- 预算: `state/budget.txt`（默认为 `.env` 的 `ASSET_BUDGET_USD`，没有则 $20）通过 MANIFEST 合计强制执行。预计超出时停止生成→在 Checkpoint 交给人类
- Steam AI 披露文从 MANIFEST 自动生成（汇总 `license_note` 的标注条款）
- 人类/agent 的修正、策展（修图、选择理由）也追加写入（强化可获得版权保护的可能性）

## 风格一致性协议（3D 补充）

3D 资产的画风统一默认采用「统一风格的 2D 概念图（key image 系列）→ image-to-3D」两段式。全部模型生成以反映 art-bible.json 的 style_block 的概念图为输入，固定同一提供商、同一设置。角色在全部姿势、全部动画中共用 character_reference 的概念图。

## 在 Checkpoint 向人类展示的许可标记

- ElevenLabs「Studio Games」条款: 商用×多平台发布需要咨询 Enterprise
- Ideogram: 应用内 AI 生成标注条款
- 在美国纯 AI 输出的版权尚不确定 → MANIFEST 的人类参与记录是防御材料
- （3D）使用 Hunyuan3D 时: EU/英国/韩国的 Territory 排除与 MAU 限制（上述硬性禁止事项）
- （3D）Meshy/Tripo: 确认为 Pro 以上套餐的结果（Free 输出为 CC BY 4.0 / 不可商用。Meshy 直连 API 的密钥有效=Pro 以上的间接证明 — 展示 `state/asset-routing.json` 的 `plan_tier` 实测值）
- （3D）fal 托管版 Meshy 输出的许可继承未验证（仅确认了 fal 模型页面的 Commercial use 徽章）— 有经 fal 生成的部分时必须披露
- （3D）存在 `cost_estimated: true` 的资产时: 积分→USD 换算为保守估算
- （unreal）UE EULA: 禁止将引擎代码/内容用作生成 AI 的输入（自作代码不在此限）。版税 5%（超过 $1M 的部分）
