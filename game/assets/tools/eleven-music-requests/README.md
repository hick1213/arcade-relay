# Eleven Music request bodies — BGM-01/02 regeneration (S-31)

2026-09-04T00:25:50Z 実測で schema 完全検証済み（422 検証チェーンを最後まで通過し、
それ以降は free プランによる 402 paid_plan_required のみで遮断）。
ElevenLabs 付费计划（Starter 以上）解锁后、以下の手順で即座に再生成できる。

## 実行手順

```bash
set -a; source .env 2>/dev/null; set +a
curl -X POST https://api.elevenlabs.io/v1/music/detailed \
  -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" \
  -d @bgm-inn-day-72000ms.json --output bgm-01.mp3
```

## 実測で判明した API 制約（2026-09-03/04）

1. `force_instrumental: true` は `composition_plan` と**相互排他**（422 `can only be used with prompt`）。
   人声排除は `negative_global_styles: ["vocals"]` で担保すること（両ファイルに設定済み）。
2. `music_length_ms` は `composition_plan` と**相互排他**（422）。曲長は sections の
   `duration_ms` 合計（12000+24000+24000+12000=72000 / 16000x3=48000）で指定する。
3. top-level の `prompt` は `composition_plan` と**相互排多**（422 `exactly one of`）。
   セクション `text` が実質の prompt を担う。
4. `sections[*]` の必須フィールド: `section_name` / `positive_local_styles` /
   `negative_local_styles` / `lines`（instrumental でも `[]` が必須）。
   global 側は `styles` でなく `positive_global_styles`。
5. seed 920301（SFX/BGM 共通のプロジェクト seed。MANIFEST の seed_note 参照）。

## 再生成後の pipeline

assets-config.md「生成後流水線」どおり:
two-pass loudnorm (I=-16 TP=-1.5, linear) → BGM 循環検証（2 段 concat 接縫スキャン、
seam-anchored 2048-sample frame grid）→ OGG Vorbis `-b:a 132k -minrate 132k -maxrate 132k`
（libvorbis は窄帯内容で ABR/VBR が下限を守らない — state/reviews/assets-audio.md 実証）→
M4A/AAC 160kbps。BGM の小節境界ループのため、sections 合計が整数小節に収まるよう
BPM（92/132）に合わせ duration_ms を調整すること。
