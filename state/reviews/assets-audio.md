# AR-ASSET — audio 批次（BGM-01/02）审查历史

## AR-ASSET iteration 1 — CONCERNS
- 日期时间: 2026-09-03T15:43:57Z
- 对象: game/assets/audio/bgm-inn-day.ogg/.m4a、bgm-final-battle.ogg/.m4a、MANIFEST.jsonl BGM-01/02 行、design/assets.md BGM 状态与生成实绩
- 机器核对结果（自测值，非转抄 MANIFEST）:
  - 响度（ffmpeg loudnorm 实测）: BGM-01 OGG -15.4 LUFS / TP -1.9 dBTP、BGM-02 OGG -16.2 LUFS / TP -4.0 dBTP；M4A -15.5 / -16.3 LUFS。全部落在 -16 ±1 内 → PASS
  - 循环接缝（独立 2 段拼接扫描、解码后 PCM、2048 样本窗）: BGM-01 接缝 RMS 阶差 10.35dB < 全曲攻击分布 p95=10.82dB、接缝样本差分 870（=0.0266 归一化）vs 全局 p99.9=742 → 无咔哒声、无阶差异常 → PASS；BGM-02 阶差 1.93dB < p95=3.53dB、差分 85 ≪ p99.9=567 → PASS
  - 格式/时长: OGG Vorbis + M4A/AAC 双格式齐备（phaser 要求）。70.435s / 47.273s，与 MANIFEST duration_final_s 一致。72s/48s 规格偏差已在 assets.md「生成实绩」记载（整数小节约束）→ 容认
  - sha256: 4 文件全部与 MANIFEST 一致 → PASS
  - provenance: BGM-01/02 行必需字段齐备（provider/model/prompt/seed/style_codes/cost_usd/plan_tier/sha256/license/license_note/generated_at + loop_verification/validator），must_replace: true 与 license_note（jsfxr public-domain、must-replace 说明）已转录。assets.md BGM 表状态已更新为 must-replace＋生成实绩节追加 → PASS
  - fallback 履历: elevenlabs:music-v2 → 402 paid_plan_required（退避重试后仍 402）→ local:Stable Audio Open Small 未安装 → local:jsfxr-ambient。全段尝试已记录，符合 retro-e3 问题7 规范
- 问题摘要（按优先级）:
  1. 【规格偏差 — 本判定唯一不合格项】BGM-01/02 的 OGG 实测平均码率 62.7kbps / 68.3kbps（ffprobe bit_rate），低于 assets.md 音频节规定的交付范围 **OGG Vorbis 128–160kbps** 的下限约一半。M4A（164/170kbps）合规。原因: q5 VBR 对窄带正弦内容自动降码率。内容上推定透明，但码率是交付规格的硬性数值，且该资产将来被付费计划替换时 pipeline 会沿用同一编码设置 — 需修正编码参数并重新交付。M4A 侧合格，不需重新生成
  2. 【披露事项、非不合格】BGM-01/02 为 must_replace 占位（chip 音源近似，非古筝/笛子/太鼓实录质感）。根因 Eleven Music 402 paid_plan_required（free 计划不含 Music API），重新生成无法解决。Checkpoint 必须披露
  3. 【披露事项、非不合格】state/asset-routing.json 的 routes.bgm=elevenlabs:music-v2＋preflight shippable 判定在生成时点被实测证伪（Music 402）。生成中未重新判定路由本身合规，但该 shippable 记录对 BGM 不成立，须修正/披露
- 处理: （由 revise 方填写。已处理/暂不处理＋理由）
- 处理（audio-designer、2026-09-03T15:50:19Z 实施記録）:
  1. 【已处理】OGG 码率修正 — 无需 API 重新生成（jsfxr 组装器确定性、seed 920301）。复用 /tmp/forge-bgm 残存的 pre-encode loudnorm WAV（时长 70.434785s / 47.272721s 与交付一致确认同源）重编码。**实证发现**: `retryInstruction` 提示的 `-b:a 132k`（ABR）单独指定仍不足 — libvorbis 比特率管理对窄带正弦内容无下限约束，实测平均 46.9kbps（头部名义值仅 132k，比原 q5 的 62.7 更低）。最终采用硬约束 `-c:a libvorbis -b:a 132k -minrate 132k -maxrate 132k`，实测平均 **133.1kbps**（两曲均为 133.13/133.14，128–160 规格内）。备选实测: q8=105.9kbps（不足）、q10=246.6kbps（超上限）、ABR 160k+range=148.4kbps（合格但偏离 retryInstruction 的 132k 目标）— 择硬约束 132k。M4A 同源重编码（160kbps 设置不变，实测 164/170kbps）
  2. 【已处理】重编码后全项复检（交付 OGG 解码后实测）: 响度 BGM-01 -15.4 / BGM-02 -16.1 LUFS（±1 内）、TP -1.9 / -3.9 dBFS（≤-1.5）→ PASS。接缝扫描改用 **seam-anchored 2048 样本帧网格**（接缝步长与 p95 分布同网格对齐 — 首次扫描的帧网格与接缝未对齐时两侧统计量均失真）: BGM-01 接缝 RMS 阶差 14.93dB < p95 17.47dB、BGM-02 3.05dB < p95 3.66dB、接缝样本差分 0.0036/0.0007 < 全局 p99.9（0.0226/0.0172）→ 两曲 PASS、无咔哒声。sha256 重算并更新 MANIFEST（OGG a5d8180b…/77f5ad04…、M4A 94214ebf…/d96b72a4…）
  3. 【已处理】MANIFEST BGM-01/02 行原位更新（avg_bitrate_kbps、postprocess、loop_verification、validator.bitrate_ogg、notes 追加 revise 履历、reencoded_at）、design/assets.md「生成实绩」交付格式修正节追记。问题2（must_replace 占位）与问题3（routing shippable 记录对 BGM 不成立）为披露事项，不因本次修正变化 — 留存 Checkpoint 展示
  4. 【成本】本次修正为本地重编码，$0 追加。MANIFEST cost_usd 合计 $0.28 / 预算 $20
