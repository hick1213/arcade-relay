# state/active.md — 会话交接（更新: 2026-09-03T10:01:57Z）

## 当前位置
Phase 2 Setup 完成（tech-director）。产出物:
- game/ 脚手架: Vite + TS(strict) + Phaser 3（^3.90.0）、必需 4 scripts、5 必需场景、systems/meta/persistence/ui 边界骨架、ASSET_KEYS 容器于 src/config.ts。验证: `npm install && npm run typecheck && npm run build` exit 0
- docs/architecture.md（场景构成/系统边界/数据流）、docs/conventions.md（游戏专有追加规范）
- state/stories.yaml: S-01～S-29（prototype 15 + build 14）。Title=S-12 / Menu=S-13 / 元进度=S-14 / 环境=S-02

## 下一步操作
按 stories.yaml 顺序实现 prototype story（S-01 输入抽象化 → S-02 环境 → …）。各 story CR-CODE 后推进; lane 合流后批处理验证（typecheck+build）。随后 AssetGen 并行、Integrate、QA-PLAY（含 Title→Menu→Game→Result→Menu 与持久化验证）→ Checkpoint B。

## 未解决事项（带入实现）
1. 【高】DR-GDD iteration 3 的 3 项修订未经 reviewer 再判定 — Checkpoint B 时验证（gdd 数值算式已在 config.ts 抄写策略中遵循）。
2. 【中】gpt-image-2 经 packcode 中转的生成风险与 fallback 终点 must-replace（见 Phase 1 移交）。
3. 【中】图像 30/30 满额、P-02 成长差分全程序化（S-07/S-28 重点验证）。
4. 【低】ElevenLabs free tier（license_note: elevenlabs-free-tier）。
5. 人类已确认的 brief 名义差异: 总评分不含用时; 工钱 30 两/日×5。
