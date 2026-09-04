# TODOS

## Harness (ArcadeRelay)

### 依赖图并行（retro-e2 方案C — 方案A+B 的下一阶段）
**What:** 在 stories.yaml 中声明 `depends_on: [S-xx]`，将独立 story 跨 assignee 最多并行 N 路（已实现的 assignee 2 lane 的一般化）。
**Why:** 方案A+B（assignee lane 并行 + 验证批处理化）已于 2026-07-21 实现。要进一步缩短需要依赖图。
**Context:** 设计方案见 `.codex/docs/retro-e2.md` 并行化节的方案C。worktree 分离在 Unity 中不推荐（Library 复制成本 + 单实例锁）。同一树内并行需要把竞争审查（同一文件编辑检测）机械化到 Setup 中。
**Effort:** L
**Priority:** P3
**Depends on:** E3 run 中方案A+B 的实测（lane 竞争率、batch-verify 失败率）

### Unity 职能 skill 群（Timeline / Animator / VFX / UI 装饰）
**What:** 为 Unity 的各功能（Timeline, Animator, Particle/VFX Graph, UI 装饰/tween）分别制作专门 skill，并在 Build Phase 的对应 story 中启动。
**Why:** 用户反馈「距离 AA 水准还很远。特别是特效、UI、UX 方面。最好为 Unity 的各功能制作 skill 并分别委托」。通用的 gameplay/ui-engineer 的表现手段储备太浅。
**Context:** skill 候选与分工方案见 `.codex/docs/retro-e2.md` 的 craft-skill 节。
**Effort:** XL
**Priority:** P2
**Depends on:** None

### P-1: 冷却类的 generation-ID 化
**What:** 调查 AutoAttackDriver 等的冷却管理是否应迁移到能承受 pooled 复用的 generation-ID（rent 世代计数器）方式，还是现行重置方式已足够。
**Why:** adversarial 审查 INVESTIGATE 项目 P-1。pooled 复用时前一 life 的计时器引用理论上可能残留（现行测试中未复现）。
**Effort:** M
**Priority:** P3
**Depends on:** None

### 并行 lane 纪律的实跑验证（E3 验证负债）
**What:** 在 E3 run 中实测 lane 纪律（LANE_RULE / laneVerify / 指定路径 commit / hash 实证验证）的 agent 遵守率与 batch-verify 失败率、lane 竞争率，若有偏离则从提示词升级为机械强制（hook / 工具限制）。
**Why:** DSL stub 测试验证脚本侧分支，但提示词强制的遵守只能通过实际运行来测量（/ship coverage 审计 GAPS 4、6）。
**Effort:** M
**Priority:** P2
**Depends on:** E3 run 实施

### agent 返回字符串嵌入 shell 命令模板（adversarial 2026-07-30）
**What:** workflow 提示词以 `git commit -m "... — <bug.title>"` / `"<story.title>"` 的形式将 agent 返回字符串直接嵌入到 commit 命令示例中，含 `"` 或 `$( )` 的 title 会破坏引用。考虑改为 `-F` 文件方式或加入清洗指示。
**Why:** adversarial 审查 INVESTIGATE（2026-07-30、v0.4.1.0 发布时遗留）。属于既有路径而非 diff 起源，但与判定提示词注入对策（同 PR 中修正）同族的 trust boundary。
**Effort:** S
**Priority:** P2
**Depends on:** None

### unresolvedFindings 的顺序非确定性与 resume 缓存分叉（adversarial 2026-07-30）
**What:** 并行 lane 的 push 顺序依赖 interleaving，resume 重跑时 CD-CHECKPOINT / finalize 提示词的序列化字符串会变化，导致缓存失效→重新判定。需判断是在提示词固化前做稳定 sort，还是接受重新判定。
**Why:** adversarial 审查 INVESTIGATE（2026-07-30）。并行 push 站点的增加可能扩大 E3 实测「缓存分叉连锁 ≈1h 浪费」的影响面。
**Effort:** S
**Priority:** P3
**Depends on:** None

### P-5: UrpShaderUtil warn-once 的可观测性
**What:** 调查 UrpShaderUtil 的 shader fallback warn-once 是否会妨碍对降级发生的观测，必要时将发生计数汇总到 QA 报告。
**Why:** adversarial 审查 INVESTIGATE 项目 P-5。warn-once 是防 spam 与可观测性的权衡。
**Effort:** S
**Priority:** P3
**Depends on:** None

## Completed

### W-3: 资产类别与 contract §8 的机械同步（原 GEN_SCHEMA assetKind）
**What:** 实态调查的结果是 assetKind 早已不在 GEN_SCHEMA 中，真正的漂移面是 full-build.js 的 MODEL_WORDS 词汇判定。改为在 Replan 提示词中强制附加资产类别标签（[MDL]/[ANM]/[IMG]/[SFX]/[BGM]），以标签优先、词汇 fallback 的方式分派，并由 `.codex/tests/workflows/contract-sync.test.mjs` 机械验证 contract §8 的 ID 类别、状态词汇与脚本复述的同步。2D 引擎中被判定为 3D 的 story 从两个批次都脱落的情况也纳入 [BLOCKER] 累积。
**Completed:** v0.4.1.0 (2026-07-30)

### Workflow resume 的重复应用防护（adversarial M-8b）
**What:** 将 IDEMPOTENT_RULE（工作前确认既有 commit、常量、注记、MANIFEST，不重复追加写入）前置到 full-build.js / prototype.js 的 impl / fix / close / bookkeep / integrate 提示词。把「已 done 则什么都不做」的幂等措辞移植到 prototype.js 的 bookkeep，并把 fix-qa label 按 bug 单位（`fix-qa-r<N>-<assignee>-<idx>`）唯一化。
**Completed:** v0.4.1.0 (2026-07-30)

### 消除 lane/track 异常与错误路径的无记录问题（审计 2026-07-29）
**What:** 用 laneSafe（在 thunk 内 catch → [BLOCKER] 累积）在所有 parallel 站点（Build/Polish/AssetGen/FullQA）堵住 parallel() 把异常压成 null 导致 lane 中断不进入未解决事项的漏洞。消除 full-build.js 的 close/fix/replan-gdd/QA fix/cd-fix/drift 空 failedAssets、prototype.js 的 CD 再判定 null、concept-design.js 的 CD fix null 的无记录路径。DSL 测试 31→59 件（新设 concept-design.test.mjs / contract-sync.test.mjs）。
**Completed:** v0.4.1.0 (2026-07-30)

### Build Phase 的并行化（retro-e2 方案A+B）
**What:** 将 prototype.js / full-build.js 的 story 实现改为 assignee 2 lane（gameplay/ui）并行，并把引擎验证集中到 lane 合流后的批处理验证区间（串行、带 story 单位切分）。
**Why:** 用户反馈「Build Phase 非常耗时」。E2 实测 Build ≈ 6h / Phase 3 ≈ 9h+9h 的主因是 story 串行 × 每个 story 的 Unity 验证（3～8 分钟）。预期缩短 5～6 成。已通过 DSL stub 测试（.codex/tests/workflows/、15 件）机械验证 batchVerify 的全部分支与 lane 分配。
**Completed:** v0.3.0.0 (2026-07-21)
