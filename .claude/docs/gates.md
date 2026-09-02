# ArcadeRelay Gate 提示词库

> skill/workflow **通过 ID 引用** Gate（不把提示词正文复制到各处＝防止漂移）。
> 判定者 agent 必须在响应的**第 1 行**输出 `<GATE-ID>: APPROVE|CONCERNS|REJECT`（contract.md §5）。
> APPROVE=合格 / CONCERNS=带问题（必须附 revise 对象列表）/ REJECT=需根本性修正（必须附理由）。

## DR-CONCEPT（design-reviewer → design/concept.md）

从以下要点批评 design/concept.md:
1. **乐趣假设是否可证伪** — 「什么好玩」能否用一句话说清，且是否为可在原型中验证的形式
2. **支柱（P-xx）的质量** — 3～5 个。彼此独立，且具有可用于裁定决策的具体性（「好玩」等无内容的支柱不可）
3. **核心循环** — 开始→挑战→奖励→再挑战能否在 30 秒内说明，且能否在 1 个画面内成立
4. **范围** — 数小时的自主实现能否到达。若过大则列出削减候选
5. **MDA 一致性** — Mechanics 是否产生通向预期 Aesthetics 的 Dynamics
若为 CONCERNS，按优先级顺序以条目列出应修正之处。

## DR-GDD（design-reviewer → design/gdd.md）

从以下要点批评 design/gdd.md:
1. **与 concept.md 的一致性** — 所有系统是否都引用了某个支柱 P-xx。对不贡献于支柱的系统提出删除建议
2. **可实现性** — 各系统是否分解到能在所选引擎（`state/engine.txt`。按引擎区分的 tech-stack 文档的技术栈与规范 — contract.md §11）中数小时内实现的粒度
3. **数值的具体性** — 速度、HP、分数等是否以初始值＋调整范围写出，而非「以后再定」
4. **完备性** — 胜利/失败条件、重新开始、游戏流程（必需场景集合 `Boot→Title→Menu→Game→Result→{Game|Menu}` — contract §11。Menu 的必需要素: 开始游玩、游戏外显示、设置、退出入口）是否已定义
5. **矛盾扫描** — 各节之间的不一致
6. **游戏外完备性** — 「元进度（游戏外）」节（templates/gdd.md）是否存在，(a) 最高分/最佳时间+统计已定义，(b) 从可选要素（货币/解锁/成就/跨局升级）中采用 2 个以上（少于 2 个为 CONCERNS。货币在没有消费去向时不能单独计数。即使与范围约束〔要点2〕冲突也不削减下限 2，而应指出「用实现成本最小的组合 — 例: 解锁=仅解放标志+成就=仅判定式 — 来满足」），(c) 各要素与支柱 P-xx 关联，(d) 具有数值参数的要素（货币、升级，以及解放条件/成就条件的式子中包含的阈值）以初始值+调整范围写出且没有「以后再定」，(e) 存档对象键与首次启动时的行为（无存档时的初始状态）已定义，(f) ID 是否为 contract §8 的 `ACH-xx`/`UNL-xx`/`UPG-xx` 格式

## AR-BIBLE（art-reviewer → design/art-bible.md + key image）

从以下要点批评:
1. **风格锁定的机器可读性** — art-bible.json 中固定风格描述块、hex 调色板、style_codes 是否齐备，是否为可前置于所有提示词的形式
2. **游戏内可辨识性** — 以此风格，玩家/敌人/背景的轮廓能否被即时区分（游戏是在 1 个画面内以秒为单位做判断）
3. **生成可复现性** — 是否是花数小时生成 30 个资产也不会漂移的指定（仅有模糊形容词的指定不可）
4. **技术一致性** — 分辨率、瓦片尺寸、透明方针是否与 assets.md / 所选引擎的 tech-stack 文档（contract §11）一致。engine=unity/unreal 时是否存在「3D 风格方针」节（多边形预算、贴图/PBR、rig 方针、比例规范）且与 assets-config.md 的 3D 默认值不矛盾

## AR-ASSET（art-reviewer → 生成资产批次）

对照 design/art-bible.json 为各资产打分:
1. 风格一致（调色板偏离、画风漂移）
2. 轮廓可辨识性（缩小到游戏内尺寸后能否辨别）
3. Alpha 边缘质量（白边、锯齿、背景残留）
4. 规格一致（design/assets.md 的尺寸、朝向、帧数）

音频资产（SFX/BGM）的情况，代替 1～4，用 ffmpeg/ffprobe 机械检查以下各项:
1. **响度** — 实测是否落在 -16 LUFS ±1 内（`ffmpeg loudnorm` 实测值）
2. **循环质量（BGM/循环素材）** — 2 段拼接后扫描接缝处的咔哒声/RMS 落差，确认无落差
3. **规格一致** — duration 是否与 design/assets.md 的指定一致，是否以引擎默认格式（phaser: OGG+M4A 两者 / unity: OGG / unreal: WAV — 各 tech-stack 文档）存在
4. **音频需求核对** — 是否与 design/assets.md 的音频需求（流派/BPM/调性/可否循环）一致

3D 资产（MDL/ANM。engine=unity/unreal）的情况，代替 1～4 检查以下各项（机械执行 assets-config.md「生成后流水线」的 3D 节）:
1. **规格合规** — GLB 用 `npx @gltf-transform/cli validate` 确认错误为 0。**FBX 用 Blender headless import → GLB export → 通过同样的 validate**（无法转换、有错误则不合格。不让 FBX 直接放行）。另加结构检查（Blender headless 重新导入检查拓扑、骨骼名、clip 有无）
2. **预算、结构** — polycount 是否在 design/assets.md 的指定内（默认: hero ≤ 50k / prop ≤ 10k / 环境 ≤ 100k tri），是否无非流形、悬浮几何体、法线反转，材质数是否在规格内
3. **比例、朝向** — MANIFEST 的 `bbox_authoring_m`（authoring-time 计量。漏记为不合格）是否落在预期尺寸（人形相当于 1.6–2.0m。UE 换算为 cm）内，前方轴、上方轴是否正确
4. **rig（仅 rigged 资产）** — 骨骼数是否在规格内、绑定姿势是否正常、指定的动画 clip 是否全部存在
5. **风格一致** — 渲染预览（Blender headless 渲染。已导入的话引擎内截图也可）对照 design/art-bible.json 的概念图、调色板，确认无画风漂移
6. **provenance/plan_tier** — MANIFEST 中是否有 `plan_tier` 实测值与 `license`。标注条款提供方（Ideogram / Hunyuan3D / ElevenLabs 等 — assets-config.md「Provenance」）来源的资产是否已转记 `license_note`（缺失则指出）。`shippable: false` 路由（state/asset-routing.json）来源、`cost_estimated: true`、经 fal 的 Meshy（许可继承未验证）须作为问题明确指出
所有资产类别通用的附加要点: **MANIFEST provenance** — 该批次的 MANIFEST 行是否齐备必需字段（assets-config.md「Provenance」），标注条款提供方（Ideogram / Hunyuan3D / ElevenLabs 等）来源的资产是否已转记 `license_note`。缺失须作为问题明确指出（prototype 阶段没有 FullQA 资产审计，AR-ASSET 是批次级别唯一的 provenance 检查点）。
不合格资产须附上理由与重新生成指示（提示词修正方案）。

**※ 引擎导入后验证（AR-ASSET 的后段、Integrate 实施者的职责）**: FBX 的引擎导入成功、导入后边界框、动画播放（unity: Humanoid Avatar 生成成功=`Avatar.isValid` / unreal: IK Retargeter 映射成功）需要启动 Unity/UE，因此在 AssetGen 并行 lane 的 AR-ASSET 中不作为判定对象（单实例锁 — 各 tech-stack 文档）。这些由 **Integrate（串行区间）实施者机械验证，并以结构化返回向 workflow 报告**。失败、降级（Humanoid→Generic 等）由 workflow 作为未解决事项累积，并在 Checkpoint 必定展示给人类（不得只以 MANIFEST 注记了事）。

## CR-CODE（利用现有代码审查 → game/ 的代码变更。对象路径见 contract.md §11）

不使用新 agent。对 story 单位的 diff 启动 `/code-review` skill，或 `pr-review-toolkit:code-reviewer` + `pr-review-toolkit:silent-failure-hunter`。
判定的换读: findings 0 件 = APPROVE / 可修正的问题 = CONCERNS / 设计缺陷 = REJECT。
另外确认是否违反按引擎区分的代码规范 rule（contract.md §11 的表: phaser=`rules/gameplay-code.md`+`rules/ui-code.md` / unity=`rules/unity-code.md` / unreal=`rules/unreal-code.md`。共通: 禁止魔法数字、delta-time、引擎无关核心、持久化 I/O 集中于 Persistence 层）。
**并行 lane 中的前提**（Build/Polish 的 assignee lane 并行 — 各 tech-stack 文档「验证批处理化」节）: 对其他 lane 的 story 预定提供的 API 的引用，只要符合 docs/architecture.md 的设计，就不以「实体未实现」为唯一理由判为 blocker/REJECT（编译一致性由 lane 合流后的批处理验证保证。与设计不一致、误用可照常指出）。
特别确认的 silent-failure 模式:
- diff 内 `LogError`/`console.error`/`UE_LOG(Error)` 被降为 Warning 级时，若紧前的头部注释未记录降级的正当性，则为 CONCERNS 以上（Warning 会直接穿过 QA 的错误 0 检查，成为掩盖 bug 的漏洞）。**新代码从一开始就以 Warning 以下记录不可恢复条件的情况同样**（不以「降级」形式出现的同类漏洞）
- batchmode 工具（`-executeMethod` 等）的不可恢复错误是否被 LogError+return 静默吞掉（必须 throw 或 Exit(1) 以非 0 退出 — 各 tech-stack 文档）
- 存档损坏时是否在没有 `.bak` 备份保存＋显式错误日志的情况下静默初始化（contract §6）

## QA-PLAY（qa-lead → 运行中的 game/）

实际构建、启动、操作 game/ 后判定。**执行手段按引擎区分**（读取 `state/engine.txt`，遵循对应节）:

- **phaser**: 用 headless 浏览器（Playwright 等）`npm run build` → 打开 preview 并实际操作
- **unity**: tech-stack-unity.md「QA-PLAY 的执行方法」— batchmode 构建 exit 0 + PlayMode 测试中通过模拟输入发送验证核心循环 + `LogAssert.NoUnexpectedReceived()` 确认错误 0 + 含 RenderTexture 方式的截图证据（不使用 -nographics）+ 视觉健全性测试（NaN 坐标、相机朝向、材质缺失、Animator 推进）
- **unreal**: tech-stack-unreal.md「QA-PLAY 的执行方法」— BuildCookRun exit 0 + Automation RunTests（报告 JSON 中 failed 0）+ 截图证据（`-nullrhi` 无法绘制，拍摄时务必去掉）

通用判定要点:
1. **启动** — build 成功，以引擎相应的 console/日志错误 0 启动
2. **核心循环** — 能否按 design/gdd.md 记载的操作走完一轮核心循环（开始→挑战→结果→重新开始）。另外**必需场景转换 `Title → Menu → Game → Result → Menu` 必须能以实际操作（unity/unreal 为自动测试的模拟输入发送）走完一轮**（contract §11 的标准流程。同时确认 Menu 的开始游玩、游戏外显示、设置、退出入口实际存在）。**设置的实效性** — 用自动测试验证音量设置的变更实际反映到音频输出（phaser: `sound.volume` / unity: `AudioListener.volume` 或 AudioMixer / unreal: SoundMix），且在相当于重启之后值仍能恢复（**仅显示的设置 UI 不合格** — 防止 E3 中音量滑块对 Game 中 BGM 不生效却通过的问题再发）
3. **验收条件** — 对目标 story（state/stories.yaml）的 acceptance 逐条以实际操作（unity/unreal 为自动测试发送输入）验证
4. **支柱验证** — 实际游玩感是否背离 P-xx（例: 「爽快感」支柱却有操作延迟等）
5. **元进度的持久化** — (a) 用自动测试验证 run 结果保存 → 相当于进程重启（生成新实例＋从磁盘/存储重新加载）→ 值被恢复，(b) 给定损坏的存档数据时，验证不静默初始化而是 `.bak` 备份保存＋`[SaveCorruption]` 显式错误日志 1 次＋默认值恢复＋`recovered` 标志传播到 UI 层（contract §6。损坏用例除「无法解析的数据」外**至少包含 1 件「valid JSON/可加载但 schema 不正（必需字段缺失、类型不正）」**。测试使用不污染真实用户存档位置的临时路径 — 各 tech-stack 文档「存档 / 持久化」）

将证据（截图/录像/测试结果 XML、JSON）保存到 qa/evidence/，并把结果写入 qa/report.md。
**视觉证据的目视义务（所有引擎通用）**: 拍摄的每张截图必须用 Read 目视，确认对象（模型、UI 文字）确实在画面中。黑屏、文字缺失、粉色（材质缺失）为不合格。目视之前先进行机械检测: `magick identify -format "%[fx:mean]" <shot>.png` 低于 0.02 或高于 0.98 则视为黑屏/过曝疑似（SUSPECT_BLANK），切换拍摄方式重新拍摄。**UI 文字可读性的机械检查（retro-e2 问题2 — 防止 E2 中 Menu「开始游玩」埋没于装饰的问题再发）**: 对 Title/Menu/Result 的主要操作文本（开始游玩、重新开始等）与 HUD 数值，从截图中用 `magick <shot>.png -crop <WxH+X+Y>` 裁出文本区域并用 `magick identify -format "%[fx:standard_deviation]"` 计量，低于 0.05 视为低对比度疑似（SUSPECT_LOW_CONTRAST），以目视逐个判定可读性。不可读（埋没于背景、装饰）为不合格并记录到 qa/report.md。**证据文件不存在、0 字节、未实施目视的 PASS 判定无效**。Game 场景的截图要在**核心循环的主要对象（玩家/放置物，以及敌人等对抗要素 — 该游戏中存在的）确实在画面中的帧**拍摄（用自动测试推进配置、生成（spawn）后再拍摄。开始瞬间的空盘面不可）。
QA fix 中查明的环境起因的一般规则（引擎/测试运行器的陷阱），除记录到 qa/report.md 外，还要**即时追加写入** tech-stack 文档的「已知陷阱」节（没有该节的引擎文档则新设后追加。qa-lead → fix 负责 engineer 的职责。不要只埋在 run 产出物中）。

## CD-CHECKPOINT（creative-director → Checkpoint A/B/C 展示前）

给人类看之前的最终判定。确认以下各项:
1. **愿景一致性** — 产出物全套是否未偏离 brief 与支柱 P-xx
2. **展示质量** — 是否准备了人类能在 5 分钟内判断的摘要（做了什么/希望判断什么/已知课题）
3. **诚实性** — 未达成、妥协点是否未被隐藏而全部列出。特别是带 `[BLOCKER]` 前缀的未解决事项、降级（Humanoid→Generic / 真实资产→占位符 / Primary→Fallback / 使用 `shippable: false` 路由）是否在摘要开头被逐个警告（不埋没在条目列表中）
若为 REJECT，指示在给人类看之前应修正的要点。
