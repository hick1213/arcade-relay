---
paths: ["game/assets/**", "game/_generated/**"]
---

# assets — 放置生成资产时的强制规范

生成与放置规则的权威来源是 `.claude/docs/assets-config.md`。此处是放置时生效的检查清单。
目标目录按引擎区分（contract.md §11）: `game/assets/`（phaser）/ `game/_generated/`（unity、unreal 的 raw 生成物＋MANIFEST）。以下「MANIFEST」指该引擎的权威来源路径。

## Do / Don't

- **Do**: 文件名使用 kebab-case + 类型前缀。`sprite-`（角色/物体图像）/ `tile-`（瓦片/背景）/ `ui-`（UI 图像）/ `sfx-`（音效）/ `bgm-`（音乐）/ `model-`（3D模型）/ `anim-`（骨骼动画）
  - 例: `sprite-hero-idle.png` `tile-forest-ground.png` `ui-button-start.png` `sfx-jump.ogg` `bgm-stage-1.ogg` `model-hero.fbx` `anim-hero-run.fbx`
- **Don't**: 不要使用 `Hero.png` `enemy_01.png` `jump sound.ogg` 这类 camelCase、snake_case、含空格、无前缀的名称
- **Do**: 每次添加、替换、修饰资产时，向 MANIFEST（该引擎的权威来源路径 — contract §6）追加写入1行。必需字段: `file` `provider` `model` `prompt` `seed` `style_codes` `cost_usd` `plan_tier` `sha256` `license` `generated_at`。若存在提供方特有的标注条款（Ideogram 标注条款 / Hunyuan3D Territory / ElevenLabs Studio Games 等），`license_note` 也为必需（assets-config.md「Provenance」）。占位资产还需加上 `"must_replace": true`
- **Don't**: 禁止不追加写入 MANIFEST 就放置资产（预算强制、Steam AI 披露、版权防御全部依赖于此）。也禁止改写、删除已有行（仅追加）
- **Don't**: 不要在保留 `"must_replace": true` 资产的状态下发布（Checkpoint C / stage=done）。构建前扫描 MANIFEST，若有残留则先替换再继续
- **Don't**: 不要放置白背景（不透明背景）PNG 的精灵/UI 图像。所有图像必须带 Alpha 通道，放置前进行机器验证
- **Do**: 音频以 OGG（Vorbis 128–160kbps）与 M4A/AAC（供 Safari 使用）两种格式同名放置，MANIFEST 中记录两个文件（phaser。unity/unreal 使用引擎推荐格式 — assets-config.md「生成后流水线」音频行 / 各 tech-stack 文档「资产处理」）
- **Don't**: 不要把许可不明、非商用（`bria-rmbg` 输出、ElevenLabs Free、audiocraft 输出等）的资产记录为 `license: commercial-ok`
- **Do**: 3D模型（`model-*`）放置前须通过 assets-config.md 3D 节的机器验证（schema 验证: GLB=gltf-transform validate / FBX=经 Blender 转换后 validate，多边形数、骨骼数、材质数、authoring 尺寸），并务必记录 MANIFEST 的 3D 字段（`kind` `polycount` `bone_count` `rigged` `format` `bbox_authoring_m` `validator` `plan_tier`。若为积分换算估算则加 `cost_estimated: true`）
- **Don't**: 禁止直接生成到引擎导入目标（unity: `game/Assets/Resources/Generated/` / unreal: `game/Content/Generated/`）。raw 必须放在 `game/_generated/`，追加写入 MANIFEST 后再导入

## 正误示例

### 命名

```
NG: game/assets/Hero.png
NG: game/assets/sprites/enemy_slime.png
NG: game/assets/audio/Jump Sound.ogg
OK: game/assets/sprites/sprite-hero-idle.png
OK: game/assets/sprites/sprite-enemy-slime.png
OK: game/assets/audio/sfx-jump.ogg + game/assets/audio/sfx-jump.m4a
OK: game/assets/audio/bgm-stage-1.ogg + game/assets/audio/bgm-stage-1.m4a
```

### MANIFEST.jsonl 追加写入

```json
{"file":"assets/sprites/sprite-hero-idle.png","provider":"fal:ideogram-v3-transparent","model":"ideogram-v3","prompt":"<style_block> + hero idle pose","seed":12345,"style_codes":["ABC123"],"cost_usd":0.06,"plan_tier":"prepaid","sha256":"e3b0c442...","license":"commercial-ok","generated_at":"2026-07-03T12:00:00Z"}
```

占位资产的情形（禁止发布标志必需）:

```json
{"file":"assets/audio/bgm-stage-1.ogg","provider":"local:audiocraft","model":"musicgen","prompt":"...","seed":7,"style_codes":[],"cost_usd":0,"plan_tier":"local","sha256":"...","license":"placeholder-nc","must_replace":true,"generated_at":"2026-07-03T12:00:00Z"}
```

### Alpha 验证（放置前必须执行）

```bash
# NG: 未验证即放置
# OK: 机器验证是否有 Alpha 通道后再放置
python3 -c "
from PIL import Image; import sys
im = Image.open('game/assets/sprites/sprite-hero-idle.png')
assert im.mode == 'RGBA' and im.getextrema()[3][0] < 255, 'no alpha / opaque background'
"
```
