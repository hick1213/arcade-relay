# AR-ASSET — 批次一致性检查（style drift 检测 pass 1、图像批次全量）

## AR-ASSET iteration 1 — APPROVE
- 日期时间: 2026-09-04T01:44:17Z
- 判定对象: `game/assets/MANIFEST.jsonl` 生成顺序全量图像 37 PNG（key-image 候选 4 + IMG-01～30 + atlas 3 页）。对照 `design/art-bible.json`（palette 10 色 / style_block / resolution sprite=1024 tile=128）。目的: 随生成顺序的调色板偏离・画风漂移・轮廓可辨识性劣化的时序检测（独立再测量、不引用 iteration 1 的旧値）
- 机器检查结果（测量值）:
  - **sha256 全 37 PNG 与 MANIFEST 一致** — 初回 APPROVE（state/reviews/assets-images.md, 2026-09-04T01:39:38Z）后文件未变更
  - **时序调色板偏离（64x64 降采样不透明像素 vs art-bible.json palette）**: MANIFEST 顺序の平均色距 meanD — key 候选 c1=21.5（锚）→ tiles IMG-01～03: 17.0–21.8 → staff IMG-04～10: 22.8–36.8 → guests IMG-11～13: 19.1–22.6 → rival IMG-14: 19.5 → dishes IMG-15～20: 31.6–43.5 → table/UI IMG-21～25: 26.3–39.6 → endings IMG-26～28: **17.6–23.5（批次末尾で锚水準に回帰）**。単調増加トレンドなし。distance>80 の pixel 比率（far%）最大 7.9%（IMG-16 蒸し包子の白色 — 題材由来）で、warm% は staff（design で cool 服を指定）を除き全 asset 95.6–100%。dishes/UI の meanD 上昇（31–44）は磁器白・金色の題材由来で画風漂移でないことを far%・warm% が裏付け
  - **画風漂移**: contact sheet（staff 7 名 224px / rival 320px / guest 3 名 224px / dish 6 種 88px / table 160px / ambition 3 種 88–96px を tile-inn-hall-day 上に合成、/tmp/ar-drift/silhouette-sheet.png）目視 — 水彩+色鉛筆の筆致・太インク褐色輪郭・cel 段階陰影が全 37 枚で均一。rival の角ばった silhouette＋墨黒/朱のコントラスト、staff cool 系 vs guest warm 系の色分けが機能
  - **Alpha**: 透明 sprite 24 枚（IMG-04～25, 29, 30）+ atlas 3 页は amin=0、背景 6 枚（IMG-01～03, 26～28）は amin=255 opaque。白背景 PNG 0 件
  - **Alpha 边缘**: 24 sprite + atlas の近边缘 white fringe 再測定 — 23 枚 0.0%。唯一の検出は sprite-dish-01-noodles 3.6%（512 サンプリングで 26px）だが実測色は (245,233,208) 系の cream 蒸気ハイライト（palette #F0C182 系）で白背景 halo でないため合格
  - **规格一致**: 実寸 6 背景 1536x1024 / 23 sprite 1024x1024 / IMG-25 1024x1536 / atlas 4096x4096 x2 + 2048x1024（frames 10+12+2=24 = 透明 sprite 数）— design/assets.md・MANIFEST size フィールドと全数一致
- 问题摘要: なし（非阻塞の観察 3 件）:
  1. `ui-ambition-wealth.png`（IMG-22）: 平均輝度 0.83・meanD 39.6 は palette の muted gold #C18E52（輝度 0.54）より明るく、「muted gold」の文言より鮮やか。ただし輪郭・質感・色相は様式内で、88px 表示でも判読可 — 再生成不要
  2. MANIFEST の IMG-04～14 行の `ref_image` が `assets/images/character-ref.png` を指すが実ファイルは `design/refs/character-ref.png` のみ（art-bible.json 側の記録は正しい）。MANIFEST は追記専用のため修正せず記録のみ
  3. dish-01 の cream fringe（上記、題材色で合格）
- 处理: 次回対応不要。観察 1 は Checkpoint で人間が気になる場合のみ再生成検討、観察 2 は次回 MANIFEST 追記時に正パスを記録すればよい
- 披露事項（Checkpoint 表示義務 — 再生成では解消しない）:
  - `cost_estimated: true`（本批次图像 30 件全て）: 中转 slb-v1.api.fan の実課金を取得できず公式解像度档位で估算（图像合計 ≈ $1.08、MANIFEST 合計 $1.36 ≪ budget $20）
  - `plan_tier: relay`: 第三者中转（packcode）経由。`commercial-ok-per-provider-terms` は中转方規約が優先する前提の記録
  - gpt-image-2 の transparent 背景は preview 機能 — 本批次は alpha 機械検証で全数 PASS 済みだが安定性は長期未検証
  - gpt-image-2 は seed/style_codes 非対応 — 一貫性は style_block 前置のみで維持（本 pass の時序測定で漂移なしを確認）
  - 同一 MANIFEST 内に `must_replace: true` の BGM 占位 2 件（BGM-01/02、jsfxr placeholder — Eleven Music 402 free tier）が残留。音频批次の判定対象だが stage=done 前の置換義務があるため Checkpoint で必ず表示すること
