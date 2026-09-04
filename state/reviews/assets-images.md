# AR-ASSET — images 批次（IMG-01～30 + ui-common-sheet-cells.json + atlas 3 页）

## AR-ASSET iteration 1 — APPROVE
- 日期时间: 2026-09-04T01:39:38Z
- 判定对象: images 批次 34 件（30 张 PNG + cells JSON + atlas 0/1/2）。对照 `design/art-bible.json`（palette 10 色 / style_block / resolution sprite=1024 tile=128）与 `design/assets.md`（IMG-01～30 规格）
- 机器检查结果（全部 PASS）:
  - MANIFEST provenance（`game/assets/MANIFEST.jsonl` 49 行）: 30 张图像 + cells JSON + atlas 3 页全部有行、必需字段（file/provider/model/prompt/cost_usd/cost_estimated/plan_tier/sha256/license/generated_at/size/quality）齐备。`seed: null`・`style_codes: []` 按 openai:gpt-image-2 路由规范正确记录（rules/assets.md）。license_note 全行转记（provider 中转条款 44 行）。图像批次内 `must_replace: true` 为 0 件（MANIFEST 内 2 件是音频批次的 BGM 占位，不在本批次）
  - 尺寸: 6 背景 1536x1024 / 23 精灵 1024x1024 / ui-event-card-frame 1024x1536 — 与 design/assets.md 逐张一致
  - Alpha: 透明精灵 24 张（IMG-04～25、29、30）全部 amin=0、四隅透明; 背景 6 张（IMG-01～03、26～28）amin=255 完全 opaque（按 assets.md alpha 验证方针）。白背景 PNG 0 件
  - Alpha 边缘: 24 张精灵的近边缘白边（white fringe）比率全部 0.00% — 无 halo、无背景残留
  - 调色板: 48x48 降采样不透明像素对 art-bible.json palette 的平均色距 17–45、距离>80 的像素占比最大 9.0%（sprite-dish-03-chicken，瓷器白与食材色所致、warm 范围内）— 调色板偏离なし
  - 轮廓可辨识性: 游戏内显示尺寸（staff 224px / rival 320px / dish・ambition 80–96px / table 160px）的 nearest/LANCZOS 缩小验证图在 tile-inn-hall-day 背景上合成目视 — 全角色・全物品即时可辨。rival-warlord 仅一角ばったシルエット＋墨黒/朱、staff 7 名 cool 系服装 vs guest 3 名 warm 系服装の色分けが仕様どおり機能
  - 背景 3 变体: morning/day/night 同一レイアウト（家具・階段・絨毯・酒壺位置一致）。night の平均輝度 0.240（p05 0.070 / p95 0.480）— assets.md の 0.2–0.75 バンド内
  - ui-event-card-frame: 枠内 alpha 平均 0.0（100% 透明）。ui-title-emblem: 中央に大きな空きエリア（cream 紙）、文字なし
  - ui-common-sheet: 7 要素（button 正/押、parchment、ledger、ingot、scroll、sword-chip）目視確認。cells JSON の bbox は実測値どおりタイト（pad 6px の外洩れ α ≤52px はアンチエイリアス程度）
  - atlas: game-atlas-0/1/2 = 4096x4096 x2 + 2048x1024、frames 計 24（透明精灵 24 枠一致）、JSON 有効
  - 文字/ウォーターマーク: 全目視対象になし（IMG-29 のタイトル文字は gdd どおりエンジン側 Text 描画）
- 問題摘要: なし（軽微な観察のみ: (1) IMG-30 の切分が計画の固定グリッド→connected-component 実測 bbox に変更 — assets.md 生成実績に実装指示付きで記録済み、ui-engineer への引継ぎは assets.md 参照。(2) tile-ending-xia の夜明け空が指示の cool teal でなく warm cream — 画風・パレット一貫性に問題なし、非ブロッキング）
- 処理: 次回以降の対応不要。上記観察 2 件は記録済みの実装解釈／許容範囲の色調差
- 披露事項（Checkpoint 表示義務 — 再生成では解消しない）:
  - `cost_estimated: true`（全 30 件）: 中转 slb-v1.api.fan の実課金が取得できないため公式解像度档位で估算（合計 ≈ $1.08、MANIFEST 合計 $1.36 ≪ budget $20）
  - `plan_tier: relay`: 第三者中转（packcode）経由のため `commercial-ok-per-provider-terms` は中转方規約が優先する前提のライセンス記録
  - gpt-image-2 の transparent 背景は preview 機能（routing notes 記載済み）— 本批次は alpha 機械検証で全数 PASS を確認済み
  - gpt-image-2 は seed/style_codes 不対応 — 一貫性は style_block 前置のみで維持（本批次目視では漂移なし）
