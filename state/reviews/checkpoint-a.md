# checkpoint-a — CD-CHECKPOINT 判定履历

## CD-CHECKPOINT iteration 1 — CONCERNS
- 日期时间: 2026-09-03（执行环境无 Bash 工具，无法按 contract §7 实测 `date -u`，取系统当日注记 — 与 state/reviews/concept.md / gdd.md 的同一处理方式）
- 判定对象: design/brief.md / concept.md / gdd.md / art-bible.md / art-bible.json / assets.md ＋ state/reviews/{concept,gdd,art-bible}.md ＋ game/assets/MANIFEST.jsonl（key image 候选 provenance）
- 要点逐项判定（gates.md CD-CHECKPOINT）:
  1. **愿景一致性 — 合格**。4 支柱（P-01～P-04）与 brief 的游戏形象/Core Fantasy 一致且相互独立，concept→gdd→art-bible→assets 的引用链无断链。P-04 两次点击制全文统一（概念、操作规格、输入模块）。范围在 brief 上限内（20 日/5+2 解锁伙计〔brief「游戏外」节明确许可的新初始伙计〕/15 卡/6 菜/3 结局、图像 30=上限满额、SFX 8/BGM 2、i18n key ≤200/语言、预算 $1.36 ≪ $20）。与 brief 的两处偏差（总评分不含「用时」、工钱 DAILY_WAGE_PER_STAFF 为 brief 外追加）均以「已知名义差异/追加声明」显式记录，无隐瞒。UNL 伙计立绘 7 张计入 30 图上限。
  2. **展示质量 — 合格（附条件）**。各产出物结构清晰、数值全为初始值＋调整范围、key image 4 候选附 art-reviewer 机器实测排序（推荐 candidate-1）与备选理由，人类 5 分钟可判断。条件: Checkpoint 展示物开头必须有摘要（做了什么/希望判断什么/已知课题），且本判定的问题摘要须逐条转录到「已知课题」栏（见下）。
  3. **诚实性 — 合格**。未发现隐瞒或乐观化改述。gpt-image-2 中转的已知限制（无 seed、transparent 为 preview、参数可能被丢弃、计费 cost_estimated）、fallback 链终点为 must-replace 占位符、ElevenLabs free tier、rembg 未安装、character_reference 为批准后必办、表情贴片与图像满额的矛盾 — 全部在 art-bible/assets/active/routing notes 中有记载。MANIFEST 的 5 行（4 候选＋art-bible 策展）provenance 齐备。
- 问题摘要（按优先级 — 须转录到 Checkpoint A 展示物「已知课题」栏）:
  1. 【高】DR-GDD 到达 MAX_ITER=3 仍为 CONCERNS（review-loops 上报项）: iteration 3 的 3 项问题（相位迁移玩家触发＋晨间计时口径、终战三档胜率算式、财/名线可行性算式＋SCORE_W_SILVER 校正＋ENDING_CAP）已由 game-designer 修订写入 gdd.md，但未经 design-reviewer 再判定。CD 抽查确认修订在文（操作规格「开门营业」「天明」两行、胜负条件三档算式与三线可行性算式、数值表 ENDING_CAP/SCORE_W 行）且内部一致，但按规则须作为未解决问题在 Checkpoint A 向人类列出，由人类批准或指示再修订。
  2. 【高】需人类裁决的 brief 名义差异: (a) 总评分不含 brief「胜负」节的「用时」项、「最佳时间」记录轴记为不适用（gdd 已附理由）; (b) 每日工钱 30 两为 brief 外追加（服务 P-03 破产线）。两者 gdd 均声明「提交 Checkpoint A 确认」— 本次展示须明确请人类确认。
  3. 【中】图像路由单点风险: Primary=openai:gpt-image-2 经 packcode 中转（plan_tier: relay），无 FAL/Ideogram 密钥 → fallback 链终点为 local:placeholder-must-replace。生成失败（退避重试后）将直接成为 must-replace 未解决事项。transparent 为 preview 功能、无 seed、中转可能丢参 — alpha 机器验证与 style_block＋edits 参考图有兜底，但 30 张的通过率未验证。
  4. 【中】图像预算 30/30 满额、余量 0: assets.md 30 张（gdd 算式 28＋背景 3 变体比 gdd 表多 2）恰好用满 brief 上限，偏差已在 assets.md 报告。art-bible「动画方针」的表情贴片（4 种×必要伙计）不在 assets.md 清单内，改由程序化差分（tint/缩放/代码绘制贴片）承担 — 若 AR-ASSET 判定必须生成则需删减其他资产或人类批准放宽。P-02「成长肉眼可见」因此完全依赖程序化差分的表现力，Checkpoint B 须重点体感验证。
  5. 【低】音频 ElevenLabs free 计划（官方条款非商用，项目决策 2026-09-03 允许发布，license_note: elevenlabs-free-tier，Checkpoint 许可标记披露）; bg_removal 本机 rembg 未安装（需 pip install，否则 ImageMagick 色键兜底）。
  6. 【低】key image 批准后的必办事项: art-director 从已批准 key image 裁出掌柜立绘存 design/refs/character-ref.png 并更新 art-bible.json 的 character_reference（当前 null，gpt-image-2 无 seed 路径下 hero 一致性的唯一锚点）。
- 处理:
