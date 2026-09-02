<!--
  模板: qa/report.md（输出位置固定为 contract.md §6 的此路径。模板名为 qa-report.md）
  producer: qa-lead（Gate: QA-PLAY 的实施记录本身。MAX_ITER 2）
  角色: 实际游玩验证的报告书（执行手段按引擎区分 — gates.md QA-PLAY: phaser=headless 浏览器 /
  unity=batchmode+PlayMode 测试 / unreal=BuildCookRun+Automation）。做成 Checkpoint B/C 时人类5分钟可读的形式
  撰写规则:
  - 全部证据保存在 qa/evidence/，正文中以相对路径引用。没有证据的 pass 无效
  - acceptance 对 state/stories.yaml 的 S-xx 全部逐条验证，1行1个 story
  - 综合判定的第1行遵循 QA-PLAY Gate 格式（contract.md §5）
  完成时删除全部指引注释。
-->

# QA Report — <游戏标题> / <目标阶段: prototype | build>

## 综合判定

<!-- 第1行必须为 Gate 判定格式。第2行起用3行以内写判定理由。
     APPROVE = 重大 bug 0、acceptance 全部通过 / CONCERNS = 有可修正的问题 / REJECT = 核心循环不成立 -->

```
QA-PLAY: <APPROVE | CONCERNS | REJECT>
```

<3行以内的判定理由>

## 运行环境

<!-- 仅写复现所需的信息。日期时间为 ISO8601。 -->

- 日期时间: <ISO8601>
- 引擎: <phaser / unity / unreal>（含版本。例: Unity 6000.3.16f1 / Chromium 138 headless）
- OS: <例: macOS 15>
- 执行系统: <phaser: Node/npm 版本 / unity: 编辑器路径 / unreal: UE_ROOT>
- 验证对象: <git commit hash 或 diff 的范围>

## 构建结果

<!-- 全部执行所选引擎的 tech-stack 文档「验证命令」，记录 exit code。
     行按引擎的命令表替换（以下为 phaser 的示例。
     unity: EditMode 测试 / ForgeBuild.BuildMac / PlayMode 测试
     unreal: BuildCookRun -build / Automation RunTests / BuildCookRun 完整）。失败时附上日志摘录。 -->

| 命令 | 结果 | 备注 |
|---|---|---|
| `npm run typecheck` | <exit 0 / fail> | |
| `npm run build` | <exit 0 / fail> | |
| `npm run preview` 启动 | <ok / fail> | |

## Console / 日志错误

<!-- 全部记录从启动～核心循环1周～重新开始的错误输出。错误0为合格条件。
     phaser: 浏览器 console / unity: 编辑器日志+LogAssert / unreal: 运行日志+Automation 报告。
     warning 仅写数量与代表例。有错误时写全文与发生时的操作。 -->

- 错误数: <N>（0 为合格条件）
- warning 数: <N>
- 详情: <错误全文与发生时的操作。0件则写「无」>

## Acceptance 验证表

<!-- state/stories.yaml 的目标 story 全部。指引:
     - 验证操作: 实际执行的操作序列（按键输入、等待时间），粒度须可复现
     - 证据: qa/evidence/ 下的截图/录像路径。pass 也必需
     - fail 的行须在「重大 bug 一览」中建立对应条目 -->

| S-xx | acceptance（从 stories.yaml 转记） | 验证操作 | 判定 | 证据路径 |
|---|---|---|---|---|
| S-01 | | | <pass / fail> | qa/evidence/ |

## 必需场景切换与持久化（gates.md QA-PLAY 要点2/5）

<!-- 全部游戏必需的2项验证。未实施/无法实施时不可 APPROVE。 -->

| 验证 | 手段（测试名/操作序列） | 判定 | 证据路径 |
|---|---|---|---|
| Title → Menu → Game → Result → Menu 的1周 | | <pass / fail> | qa/evidence/ |
| 存档 → 相当于重启 → 恢复一致 | | <pass / fail> | qa/evidence/ |
| 损坏存档 → .bak 备份保存 + [SaveCorruption] 错误1次 + 默认值恢复 | | <pass / fail> | qa/evidence/ |

## 截图目视所见（必需）

<!-- 对拍摄的每张截图用 Read 目视后的所见各写1行（gates.md QA-PLAY 视觉证据的目视义务）。
     机器检测（magick 的 mean 值）→ 目视的顺序。黑屏、文字缺失、粉色材质不合格。
     不只是宣称「已目视」，而要写「拍到了什么」（例: 「Menu: 开始游戏按钮与统计3行可辨读」）。 -->

| 证据路径 | mean 值 | 目视所见（拍到了什么） | 判定 |
|---|---|---|---|
| qa/evidence/ | | | <ok / ng> |

## 支柱验证所见

<!-- design/concept.md 的 P-xx 全部。写实际游玩感的所见而非数值
     （例: 「P-01 毫厘之差的回避: 碰撞判定比外观大，感觉不合理 → CONCERNS」）。
     若有背离，对照该支柱的「用于裁定的判断示例」指出。 -->

| P-xx | 所见（实际游玩感） | 判定 |
|---|---|---|
| P-01 | | <ok / concern> |

## 重大 bug 一览

<!-- 仅限无法推进、崩溃、acceptance fail 的原因（轻微的外观问题写在所见中）。
     复现步骤为「从初始状态起的编号步骤→期望结果→实际结果」的格式。证据路径必需。
     0件则删除表格并写「无」。 -->

| # | 症状 | 复现步骤 | 期望/实际 | 证据路径 | 相关 S-xx |
|---|---|---|---|---|---|
| 1 | | | | qa/evidence/ | |

## 已知妥协点与未验证事项

<!-- 不隐瞒地列举（会在 CD-CHECKPOINT 的「诚实性」要点中核对）。
     例: 「触摸操作未验证（仅键盘）」「BGM 循环的接缝有1处轻微咔嗒声」 -->
