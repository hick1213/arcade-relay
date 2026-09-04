# E3 run 审计（Crystal Bastion、unity、至 Phase 2）— 严苛复盘

> 2026-07-22。审计者视角。E3 = v0.3.0.0 并行化 harness 的首次实跑（Phase 1 → Checkpoint A → Phase 2 → Checkpoint B 时由人类判断停止）。
> 实测的一手信息: git 提交时间线（79 commits）、workflow usage（Phase 1: 18 agents / Phase 2: 69 agents、5.37M tokens）、qa/evidence、MANIFEST。

## 实测摘要

| 区间 | 实测 | 与 E2 比较 |
|---|---|---|
| Phase 1（策划设计、3个 Gate）| 75 分钟（agent 18、全部 Gate 2轮收敛） | 同等 |
| Phase 2 Setup（scaffold+stories） | 24 分钟 | 同等 |
| Phase 2 实现区间（S-01～S-09 + CR-CODE） | **约 3.0h、19.7 分钟/story** | E2: 6h/11 stories = 32.7 分钟/story → **约缩短 40%（与方案A 的预测一致）** |
| Phase 2 串行尾部（batchVerify→Integrate→QA→CD） | 约 3h+ | 与 E2 同等（未改善） |
| 会话中断 + resume divergence 的浪费 | **约 1.5～2h** | E2 亦有同类（无改善） |
| 资产成本 | $2.80/$20（估算） | 健康 |

**结论: lane 并行起作用了（在提交日志中确认 gameplay∥ui∥资产 3条 lane 同时推进、batch-verify 1次合格、因 lane 冲突而做的修正仅测试1件）。但 Phase 2 整体的体感缩短有限。** 瓶颈从实现区间转移到了「串行尾部 + 故障恢复」。

## 严苛问题（按优先度排序）

### 1.【重大·再发】同一 bug 的跨轮次再发 — harness 没有从 E2 学到东西
E2 中踩过的「Title 场景中点击/任意键不切换到 Menu」bug（batchmode 的 InputSystem `[UnitySetUp]`/`[UnityTest]` 边界问题），**E3 中的新实现又原样踩了一遍**（07-21 23:12 QA fix）。此外同族问题在 S-08 的 GameHud 测试中也踩到，成了 batch-verify 修正（1个 run 中同族 2 次）。E2 的 qa/report、审查历史中已明确记为已知，但**没有把知识注入到下一款游戏代码生成的路径**。
**处方**: 制定规范，把永久知识提升到 **harness 侧（rules/unity-code.md 或 tech-stack-unity.md 的「已知陷阱」节）**，而不是 run 产出物（qa/report）。在 full-build/prototype 的 QA 循环中加入步骤: 在 QA fix 中被判定为「环境起因的一般规律」的内容，不等复盘，立即追加写入 rules。

### 2.【重大】Checkpoint B 的体感价值结构性偏低 — E2 反馈的主旨未反映
E3 的 Game 盘面漆黑一片（地形/背景/相机正式布置推到 build 阶段）。E2 Checkpoint C 中人类说的「想要背景、外观与想象不同」，作为**垂直切片外观的最低线**问题堆在 retro-e2 §2（Unity 职能 skill）里一直未实现。结果，把 Checkpoint B「仅此1次的人类反馈」浪费在『盘面很暗但请看骨架』上的结构连续 2 个 run。
**处方**: 把「环境的最低限度视觉表现（地面+光照+相机确定）」提升为 prototype 范围的必需要素（在 tech-director 的 story 分解规范中加1行）。retro-e2 §2 的 craft skill 群仍是 P2 — 应提高优先度。

### 3.【重大】故障恢复设计缺失 — resume「能动」但「不便宜」
会话中断导致 workflow 死亡，resume 后**从未完成 agent 的重新执行开始 findings 发生变化，缓存分叉连锁**。07-22 11:07～12:01 发生了 S-01/S-02/S-03/S-06/S-07/S-08 的重复提交（历史污染 + 约 1h 的重复工作 + stories.yaml 的 status 回摆风险）。运维者（我）自己打破了 E2 的教训（已在记忆中记录「尾部 workflow 更便宜」）。
**处方**: (a) 在 workflow 中设计「阶段边界 checkpoint」，把 resume 从最后完成的阶段边界只重构尾部的运维正式化为标准步骤（写进 skill 文档）。(b) 把重复提交检测（同一消息再次提交前用 `git log` 核对）与已添加到 CODE_COMMIT_RULE 的 hash 验证成对强制。

### 4.【中】QA 视觉证据 Gate 的漏洞 — 「没拍到」的截图通过了
qa-visual-game.png 是波次 1 刚开始，塔、敌人、核心实质上没拍到（几个像素的点）。QA 诚实地注记后判为 ok — **Gate 文字要求「对象已拍到」却未规定拍摄时机**，因此附上诚实注记的空盘面也能通过。
**处方**: 在 gates.md QA-PLAY 的视觉证据中明文化「Game 场景在已放置塔 + 敌人存在于画面内的帧拍摄（在 PlayMode 测试中推进放置→生成（spawn）后拍摄）」。

### 5.【中】审查缺失静默流过 — AR-ASSET（音频）未实施便到达发布线
音频批次的 AR-ASSET 审查因 safety classifier 的临时错误变为 null → 循环记录了「reviewer 未返回结果」后**继续前进**。一次重试也没有。虽然载入了披露，但 6 个资产在零审查状态下已接线到垂直切片。
**处方**: 把对 agent() null 的1次自动重试作为 workflow 通用规则（transient 错误官方也称「retry often succeeds」）。重试后仍为 null 则按现行上报。

### 6.【中】用现场判断填补了 contract 漂移 — 资产导入目标的模糊性
Integrate 没有放在 `Assets/Generated/`（contract §11/tech-stack 记载）而是放在 `Assets/Resources/Generated/`（优先与以 `Resources.Load` 为前提的 AssetKeys 设计保持一致，判断依据记录在 README）。判断本身合理，但因为**权威来源未规定实现样式（Resources.Load 还是直接引用）**，才需要现场解释。E2 中导入目标的解释也曾摇摆。
**处方**: 在 tech-stack-unity.md「资产处理」中把导入目标与加载方式（Resources.Load + `Assets/Resources/Generated/`，或 Addressables 等）一对一确定，并让 contract §11 的表跟进。

### 7.【中】3D 生成的敌人模型失败连续 2 个 run — fallback 链在实战中未起作用
E2: MDL-02（quadruped rig）失败 → 代码运动替代。E3: MDL-04 Warbeast 未生成 → 胶囊体替代。**连续 2 个 run「敌人的第 2 个模型」失败，fallback 链（经 fal→Tripo→Blender）没有跑完**。preflight 确认 Tripo 200 却未使用就落到 placeholder 的过程，从披露中看不清楚。
**处方**: 在 AssetGen 的降级报告中强制列举「尝试过的路由与各失败理由（HTTP 代码）」（规定 degradedRoutes 的粒度）。在 assetBatchLoop 提示词中加入禁止不尝试任何一段 fallback 就 placeholder 化的文字。

### 8.【小】时间戳的可靠性 — active.md 的时间与实际时间线矛盾
active.md 的「Integrate 完成 22:28:00Z」与提交实际时间（07-22 03:22Z）相差 5 小时。agent 在凭推测写当前时间。虽有必须使用 date 命令的规范，但未彻底执行。
**处方**: 把向状态文件写时间时「粘贴 `date -u` 的输出」纳入提示词定型文（已有的地方与没有的地方混杂 — 统一到全部提示词）。

### 9.【小】同一消息的重复提交（S-08 fix iter1 ×3 等）
因重试、并行的副作用，同一消息的提交多次发生。凭借 hash-by-message 获取的「最新行」规定，运行时不会损坏，但降低了历史的可读性与 bisect 精度。
**处方**: 提交消息不需要尝试标识符，但「最近历史中已有同一消息时不 amend，而在消息末尾附上理由」这种程度的规范有探讨余地。优先度低。

## 好的方面（作为记录）

- **lane 并行是真的**: 18:26 时点 S-02(ui)、S-04(gameplay)、IMG 重新生成(art)、SFX(audio) 的 4 条 lane 同时推进。实现区间缩短 40% 与预测范围一致
- batch-verify 1次合格，唯一的修正（S-08 测试）也按定位原因→最小修正→记录的规范运作。生产代码未修改
- 披露的诚实性: 降级、未验证、成本估算全部出现在 Checkpoint 材料的开头（E1 的隐瞒体质已根除）
- 元进度、持久化、损坏协议、5 场景切换在新游戏中也一次就符合规范（E2 中加入的机器验证起效了）
- 预算管理（$2.80/$20、全部路由 shippable、provenance 完备）

## 下一步操作候选（兼作 Phase 3 重启时的 Replan 输入）

1. 问题 1/4/5 的 harness 修正小而效果大 — 应在 Phase 3 前应用
2. 问题 2 会在 E3 Phase 3（S-19 资产整合）中对本游戏解决，但 harness 规范化另需进行
3. 问题 3 的「阶段边界 checkpoint」在下一次长时间 run 前有很高的设计价值
