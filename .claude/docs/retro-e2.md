# E2 评估 run 复盘（2026-07-10～15 / unity / Crystal Vanguard）— harness 改进待办

> 在 E2（unity 实跑）中观测到的问题，以及基于人类反馈（2026-07-15）的改进探讨。
> 此处是**提案的存放处**，不是规范。采用时先更新 contract.md 再让引用侧跟进（绝对规范1）。

## 结果摘要

- 完整跑通: brief → Checkpoint A → 原型（S-01～11）→ Checkpoint B → 正式实现+打磨（S-12～33）→ Checkpoint C 验收
- QA: 33/33 acceptance、EditMode 181/181、PlayMode 142/142、重大 bug 0、实际成本 $2.95/$100
- E1 中未起作用的 Gate 群（视觉证据目视、降级上报、披露渠道、Setup 机器验证）全部确认实际运作

## 源于人类反馈的探讨课题（优先）

### 1. Build Phase 的并行化（所需时间过长）

观测: Phase 2 Build ≈ 6h（11 stories 串行）、Phase 3 ≈ 9h+9h（22 stories 串行）。每个 story 的实现+CR-CODE 2轮+验证需 30～60 分钟。串行化的理由是「避免同一代码库的冲突」，但实测的瓶颈是 (a) story 的串行执行 (b) 每个 story 的 Unity 验证（EditMode+Build 每次 3～8 分钟）。

探讨方案（成本 小→大）:
- **A. assignee lane 并行（推荐、最小变更）**: 让 gameplay-engineer 与 ui-engineer 的 story 以2条 lane 并行。所有路径几乎互斥（Systems+Components vs Ui+Scenes），共享的只有 GameConfig.cs/Types.cs（已有「仅追加写入自己 story 所需常量」的规范）。E2 中与 AssetGen 并行的 git 冲突通过重试也没有实际损害。workflow 变更: 把 buildStories 按 assignee 拆分，parallel() 2条 lane、lane 内串行。预期缩短 30～40%。
- **B. 验证的批处理化**: 把每个 story 的 EditMode+Build 汇总到「每实现 2～3 件」或「lane 合流点」（编译验证由 EditMode 1次即可覆盖整体，冗余度高）。失败时切分变粗的权衡，通过「仅在失败时用二分查找逐个重新验证」的规范缓解。预期缩短 20～30%。
- **C. 依赖图并行**: tech-director 在 stories.yaml 中声明 `depends_on: [S-xx]`，独立 story 最多 N 并行。git worktree 分离在 Unity 中 Library 复制成本（数GB、首次导入数分钟）与单实例锁的约束沉重，**不推荐 worktree 分离**。同一树并行可作为 A 的一般化实现，但需要在 Setup 中把冲突审查（同一文件编辑检测）机械化。
- 注意: 伴随 Unity 启动的工序（验证、导入、QA）按现行**必须串行**（单实例锁 — tech-stack-unity.md）。并行化仅限于代码编辑与 review agent。
- **已实现（2026-07-21）**: 方案A+B 已在 prototype.js / full-build.js 中实现。assignee 2条 lane 并行（lane 内串行、以 LANE_RULE 强制负责领域/共享文件/stories.yaml 的精确 Edit）+ lane 中禁止引擎验证（EP.laneVerifyLine — phaser 仅允许 typecheck）+ lane 合流后的 batchVerify（串行、失败以 story 提交为单位切分，记录在 state/reviews/batch-verify.md）。权威来源规范已追加写入各 tech-stack 文档的验证节。方案C（依赖图并行）仍未实现（下次探讨）。

### 2. AA 品质差距 — Unity 按功能划分的 skill/专业知识（特效、UI、UX）

观测: 打磨后外观仍停留在「原型+装饰」的区域。原因是 engineer agent 是通用 C# 实现者，**提示词中不具备** Unity 高品质表现功能（Timeline / Animator 状态机设计 / VFX Graph / Shader Graph / Cinemachine / UI Toolkit 动画 / DOTween 级的缓动设计）的专业知识。E2 中止步于 Bloom+ParticleSystem+代码 tween 的朴素组合，Menu 装饰中还发生了可辨识性劣化（开始游戏文字被埋没）。

探讨方案:
- **A. 按功能划分的知识文档 + 引用注入（最小变更、无需变更 contract）**: 在 `.claude/docs/unity-craft/` 放置按功能划分的指南（timeline.md / animator.md / vfx.md / ui-motion.md / cinemachine.md / shader.md），从 tech-stack-unity.md 引用。在 ui-engineer / gameplay-engineer 的「参考文档」中添加相应指南，在 polish story 的 acceptance 中要求「至少应用1项相应指南的技法」。
- **B. skill 化（用户方案）**: 新设 `/unity-vfx` `/unity-ui-motion` 等 skill，从 workflow 的 Polish 阶段不用 agent(prompt, {agentType}) 而通过启动 Skill 来委托。**由于 contract §3 固定为6个 skill，必须修订 contract**。skill 有人类也可单独启动的优点（「只打磨这个画面」）。
- **C. 追加专业 agent（vfx-artist / ux-designer）**: 需要修订 contract §2 固定的10个。与审查系（AR-ASSET/QA-PLAY）的职责边界重新设计成本最大。
- 推荐顺序: A 立即（下次 run 前），B 在测量 A 的效果后连同 contract 修订一起，C 保留。
- 同时应在 gates.md QA-PLAY 中添加「UI 文字可辨识性的机器检查」（应用装饰后文本区域的对比度测量）— 因为 E2 中出现了装饰破坏可辨识性的实例（Menu「开始游戏」）。

## E2 中观测到的其他问题（harness 改进候选）

3. **长时间 run 的中断耐受性**: 因 API 会话上限中断 Phase2×2、Phase3×1 次。resume 因提示词链（嵌入 commitHash 等）导致缓存分叉，发生大量重复执行。对策方案: (a) 从 workflow 提示词中去掉可变值（commit hash、累积 findings），替换为「读 state 文件」以提高缓存命中率 (b) 以阶段为单位返回 checkpoint（Setup 后、Build 后先 return，由 skill 把下一阶段作为另一个 run 启动的分割执行模式）。
4. **签名中断（1Password）的运维**: 签名 agent 中断导致无法提交时实现仍可继续，但 (a) CR-CODE 的「固定 commit hash 审查」失效，process-blocker 频发 (b) 未提交的250件面临 worktree 全损风险。对策方案: 在验证命令节添加「无法签名时用 `git stash create` 创建无签名快照 SHA，把审查对象固定到它」（不污染历史即可固定对象、不构成绕过）。
5. **bookkeep 与 agent 规范的冲突**: CR-CODE 达到 MAX_ITER 时的「done+注记」更新指示被 implementer 以 Must-NOT-Do 为依据拒绝（S-01/S-08 固着在 review）。使 review-loops.md 的上报规格与 agent 定义一致（在其中一方明确写「达到 MAX_ITER 上报时 done+注记为正确」）。
6. **AR-ASSET 的 iteration 编号管理**: workflow 发出硬编码「iteration 1」的委托，与已有历史（到 iteration 4）矛盾 → reviewer 自行修正。workflow 应先统计 state/reviews/<artifact>.md 的已有 iteration 数再委托（或统一为「下一个编号由你自己从历史中分配」）。
7. **Workflow args 的字符串化**: 实测到 runner 以 JSON 字符串传递 args 的情形 → 已在3个脚本中实现规范化（已永久化、完成）。
8. **资产文件命名的体系偏离**: design/assets.md 以模板示例的 `img-` 系起草，与 rules/assets.md 的 `sprite-/ui-/...` 前缀不一致并波及全部图像。在 templates/assets.md 的文件名指引中明确写出正确前缀的示例，在起草时点防止。
9. **Ideogram 标注条款的 MANIFEST 记录**: 作为许可标志已展示，但 MANIFEST 行的 license_note 中未记录便跑完了。在 assets-config.md 的 Provenance 节添加「提供方特有的标注条款必须转记到 license_note」。
10. **must-replace 的解决路径**: MDL-02（quadruped rig）因 Meshy 422/Tripo 403 陷入死局，以已批准的替代品跑完。在路由表中添加「quadruped rig 以 Tripo 为第一预期（Meshy 仅有 humanoid 实绩）」的注记，以及 Tripo 积分余额的 preflight 显示，可加快决策。

## 已完成（E2 期间反映到 harness 的永久修正）

- workflows 的 args 规范化 / Setup 的 Title、Menu、元进度 story 机器验证+实体核对 / AR-ASSET disclosures 渠道 / 证据实际存在的独立验证与 verdict 降级 / [BLOCKER] 前置 / 生成 lane 的 .env source 规范 / 彻底执行限定路径的 git add
