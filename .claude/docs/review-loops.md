# ArcadeRelay 审查循环定义

> **所有产出物都要通过 produce→review→revise 循环后再进入下一工序。**
> workflow 脚本按此表实现循环。Gate 提示词正文通过 ID 引用 gates.md。

## 循环的通用形式

```
artifact = produce(producer)
for i in 1..MAX_ITER:
    verdict = review(reviewer, GATE-ID)      # 第 1 行 = <GATE-ID>: APPROVE|CONCERNS|REJECT
    append verdict → state/reviews/<artifact>.md   # ※追加写入是 reviewer agent 的职责（在返回 verdict 之前自行追加写入）。workflow 不追加写入
    if APPROVE: break
    artifact = revise(producer, verdict 中的问题)
if 到达 MAX_ITER 且非 APPROVE:
    上报（附上未解决问题一览，在下一个 Checkpoint 展示给人类。流水线不停止）
```

- 审查历史必须**追加写入** `state/reviews/<artifact>.md`（iteration 编号、verdict、问题摘要、日期时间）
- reviser 须明确记载对各问题的处理/不处理（禁止无视）

## 对应表

| 产出物 | producer | reviewer | Gate ID | MAX_ITER | 合格标准 |
|---|---|---|---|---|---|
| design/concept.md | game-designer | design-reviewer | DR-CONCEPT | 3 | APPROVE |
| design/gdd.md | game-designer | design-reviewer | DR-GDD | 3 | APPROVE |
| design/art-bible.md + .json | art-director | art-reviewer | AR-BIBLE | 3 | APPROVE |
| 生成资产批次 | art-director / audio-designer | art-reviewer | AR-ASSET | 3/资产 | APPROVE（3 次不合格→切换到 fallback 提供方后再试 1 次） |
| story 实现 (game/ 代码 diff。对象路径见 contract §11) | gameplay-engineer / ui-engineer | 现有 code-review | CR-CODE | 2 | findings 已解决 or 明确记载正当理由 |
| 运行中的 game/ | (全部 engineer) | qa-lead | QA-PLAY | 2 | 重大 bug 为 0、acceptance 全部通过 |
| Checkpoint 展示物 | (整个阶段) | creative-director | CD-CHECKPOINT | 1 | APPROVE（若 REJECT 则按指示修正后仅再判定 1 次） |

## state/reviews/<artifact>.md 的追加写入格式

```markdown
## <GATE-ID> iteration <n> — <verdict>
- 日期时间: <ISO8601 — 遵循 contract §7 的时刻记录规范（`date -u` 实测）>
- 问题摘要: （CONCERNS 的情况，按优先级顺序）
- 处理: （由执行 revise 的一方填写。已处理/暂不处理＋理由）
```

## 按 review-mode 的调制（contract.md §9）

- `full`: 循环自动。workflow 累积所有 verdict 历史（gate/artifact/iteration/verdict/问题摘要）并包含在返回值中，skill 在完成后的 Checkpoint 展示时将全部内容提交给人类（执行中不逐次展示）
- `lean`（默认）: 循环自动。仅到达 MAX_ITER 的未解决问题在 Checkpoint 交给人类
- `solo`: 同上（Checkpoint 本身也不停止，因此未解决问题记载在最终报告中）
