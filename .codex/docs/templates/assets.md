<!--
  模板: design/assets.md（输出位置固定为 contract.md §6 的此路径）
  producer: art-director（图像、MDL/ANM）/ audio-designer（SFX、BGM） / reviewer: art-reviewer（Gate: AR-ASSET）
  角色: 资产清单＝生成规格的权威来源。生成实绩（provider/seed/cost/sha256）记录在
  MANIFEST.jsonl（按引擎区分的权威来源路径 — contract §6）一侧。此处是「要做什么」，MANIFEST 是「做了什么」。
  撰写规则:
  - 资产数量控制在 brief.md 的范围约束内
  - id 采用 contract.md §8 的资产ID格式: 类型前缀＋连号（IMG-01 / SFX-01 / BGM-01 /
    MDL-01 / ANM-01。MDL/ANM 仅 engine=unity/unreal）。
    稳定ID（禁止删除、重新分配，废止以状态表示）
  - MANIFEST 的权威来源路径按引擎区分（contract §6）: phaser=game/assets/ / unity、unreal=game/_generated/
  - 提示词草案中不要抄写 art-bible.json 的 style_block（生成时会机械前置。
    只写资产特有的内容: 主体、姿势、朝向）
  - 路由列的值对应 assets-config.md 的路由表: primary | pixel | local
    （切换到 fallback 由 state/asset-routing.json 与 AR-ASSET 循环管理。此处不写）
  - 状态列的值为 contract.md §8 的资产状态词汇（仅此5值）: planned | generated | approved | rejected | must-replace
    （must-replace = 非商用占位资产。Checkpoint C 前必须替换）
  完成时删除全部指引注释。
-->

# Assets Manifest — <游戏标题>

## 图像

<!-- 精灵/UI/背景/瓦片集。各行指引:
     - 文件名: 按引擎区分的 raw 存放位置（contract §6: phaser=game/assets/ / unity、unreal=game/_generated/）下的
       相对路径。必须使用 kebab-case+类型前缀（rules/assets.md）: sprite-（角色/物体）/
       tile-（瓦片/背景）/ ui-（UI）。例: sprite-hero-idle.png / tile-forest-ground.png / ui-button-start.png
       （防止 E2 中源自模板示例的 img- 系命名波及全部图像的问题再发 — retro-e2 问题8）。
       纹理键由按引擎区分的 config 权威来源中的 ASSET_KEYS 管理
     - 尺寸: 以生成分辨率书写（与 art-bible.md 的分辨率方针一致）。
       精灵表写「帧尺寸 x 帧数」（例: 512x512 x4）
     - P-xx: 此资产支撑的支柱。一个都写不出的资产不要制作
     - 提示词草案: 仅写主体、姿势、朝向、地面接触等资产特有的指定 -->

| id | 类型 | 文件名 | 尺寸 | P-xx | 提示词草案 | 路由 | 状态 |
|---|---|---|---|---|---|---|---|
| IMG-01 | sprite | | | | | primary | planned |

## SFX

<!-- 音效。各行指引:
     - 文件名必须带 sfx- 前缀（rules/assets.md。例: sfx-jump.ogg）
     - 尺寸列写长度（秒）。ElevenLabs SFX v2 须明示 duration_seconds（0.5～30s）
     - 提示词草案为「声音的质感＋触发的游戏内事件」（例: 「短促的上升提示音，获得金币」）
     - 循环素材（环境音等）在草案末尾明确写 loop:true
     - 路由 local = jsfxr（确定性、可发布） -->

| id | 类型 | 文件名 | 尺寸 | P-xx | 提示词草案 | 路由 | 状态 |
|---|---|---|---|---|---|---|---|
| SFX-01 | sfx | | | | | primary | planned |

## BGM

<!-- 乐曲。在基本8列之外另有循环要求、长度、BPM/调性的指定栏。指引:
     - 文件名必须带 bgm- 前缀（rules/assets.md。例: bgm-stage-1.ogg）
     - 循环要求: seamless（在小节边界完全循环、生成后必须做循环验证）/ oneshot
     - 长度: 秒数。循环曲为1个循环的长度（取能被 BPM 与小节数整除的值）
     - BPM/调性: 全曲固定方针（assets-config.md「音乐使用固定流派/BPM/调性」）。
       曲目间若有变化也仅限于同一调的平行调
     - 提示词草案中写相当于 composition_plan 的段落结构（intro/loop 部分的划分）
     - force_instrumental:true 为默认（不可含歌词） -->

| id | 类型 | 文件名 | 尺寸 | P-xx | 提示词草案 | 路由 | 状态 | 循环要求 | 长度 | BPM/调性 |
|---|---|---|---|---|---|---|---|---|---|---|
| BGM-01 | bgm | | | | | primary | planned | seamless | | |

## 3D 模型（仅 engine=unity/unreal。phaser 时整节删除）

<!-- 角色/道具/环境。各行指引:
     - kind: character_rigged | prop | environment（与 MANIFEST 的 kind 一致）
     - 文件名: raw 位于 game/_generated/models/ 下（model- 前缀。带 rig=FBX / 静态=GLB）
     - 多边形预算: tri 数上限（assets-config.md 默认: hero ≤ 50k / prop ≤ 10k / 环境 ≤ 100k）
     - rig: humanoid | quadruped | other | none。动画列中列举所需剪辑（ANM 的 id）
     - 提示词草案: 供 image-to-3D 使用的概念图主体指定（style_block 机械前置） -->

| id | kind | 文件名 | 多边形预算 | rig | 动画（ANM-xx） | P-xx | 提示词草案 | 路由 | 状态 |
|---|---|---|---|---|---|---|---|---|---|
| MDL-01 | character_rigged | | | humanoid | | | | primary | planned |

## 骨骼动画（仅 engine=unity/unreal。phaser 时整节删除）

<!-- 附加到目标 MDL 的动画剪辑。路由 primary = Meshy 动画预设（action_id）。
     文件名必须带 anim- 前缀（rules/assets.md。例: anim-hero-run.fbx）。
     本地降级为代码运动（must-replace）。 -->

| id | 目标 MDL | 文件名 | 剪辑名 | 内容（例: walk / run / idle） | P-xx | 路由 | 状态 |
|---|---|---|---|---|---|---|---|
| ANM-01 | MDL-01 | | | | | primary | planned |

## 汇总与预算

<!-- 开始生成前必须填写。若预计超出预算，则削减资产或在 Checkpoint 交给人类。 -->

- 图像: <N个> / SFX: <N个> / BGM: <N曲> / 3D模型: <N个> / 动画: <N个>（须在 brief.md 的上限内。3D 系仅 unity/unreal）
- 概算成本合计: $<X.XX>（须在 state/budget.txt 的上限内。实绩由 MANIFEST.jsonl 强制）
