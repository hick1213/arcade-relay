# art-bible — 审查履历

## key image 排序（AR-BIBLE 要点2/3＋支柱一致性事前核对）

- 日期时间: 2026-09-03T05:39:06Z（`date -u` 实测）
- 评审对象: design/refs/key-image-candidate-1〜4.png（各 1536x1024 sRGB、RGB 3.0 通道 — `magick identify` 实测一致）
- 机器核对: Pillow 主色量化（MEDIANCUT 8 色）＋ 480px 缩小→nearest 2 倍复大的游戏内显示尺寸近似验证（/tmp/keyimage-downscale-2x2.png 目视）
- 参照基准: design/brief.md「美术方向」（手绘插画风＝国风水墨＋暖色、参考图的暖木色基调＋红金点缀、Q 版头身比）、design/concept.md P-01〜P-04、state/asset-routing.json（图像 Primary = openai:gpt-image-2 → art-bible.json 的 `style_codes: []` 属正常，不作为缺陷）

### 排序（优 → 劣）

1. **design/refs/key-image-candidate-1.png**
   - 依据: 主色实测 meanRGB=(127,80,40)、meansat=0.69、全 8 主色为暖棕〜橙木色系，与 brief「暖木色基调＋红金点缀（红灯笼/红毯/金饰）」唯一完全吻合。缩小验证中 4 名 Q 版伙计（青/蓝/粉/红甲）轮廓与表情在 480px 宽下仍即时可辨（要点2 合格）。style_block 可具体化（水彩＋彩铅质感、Q 版 2 头身、木造客栈、红金点缀），30 资产生成漂移风险中等偏低（要点3）。P-02 成长差分（变色/表情贴片）在干净轮廓的 Q 版立绘上最易实施；P-01 晨/日/夜的画面状态切换可用暖色亮度梯度自然表达
2. **design/refs/key-image-candidate-3.png**
   - 依据: 平涂＋粗轮廓的样式对 gpt-image-2 的文本 style_block 最易机械复现（要点3 强）。人物轮廓可辨性也强。但主色实测 #AF0F02（红）占约 38%、meansat=0.84 — brief 要求红金为「点缀」，此图红为基调＝调色板角色倒置；且「晨间从容→日间忙碌→夜间松一口气」的 P-01 呼吸感在庆典红基调下难以表达，20 日日常资产全部被推向红。综排第 2
3. **design/refs/key-image-candidate-2.png**
   - 依据: 字面上最贴「国风水墨」，但实测 meansat=0.21、meanRGB=(137,126,110) — brief 的「暖色」「暖木色基调＋红金点缀」不成立（红仅灯笼 1 个＝点缀缺失）。水墨淡彩的伙计表情/情感可读性弱，P-02「肉眼可见的成长」与活宝喜剧感的承载最差。可复现性中等（水墨笔触的浓淡在无 seed 的 gpt-image-2 路径下易漂移）。淡色背景反而利于精灵浮出，故仍在 candidate-4 之前
4. **design/refs/key-image-candidate-4.png**
   - 依据: 实测 meanRGB=(73,52,37)、主色亮度 light 0.08〜0.30 — 深夜暗调，与 brief「温馨烟火气/暖色」相悖。高密度描写的杂然背景在单画面经营（要点2: 秒单位判断）与移动端单手游玩（P-04）下可辨性最差，暗部在手机屏上进一步压碎细节。工笔级的密集细节在 30 资产生成中最难保持一致（要点3 最差）

### 结论

- 推荐 **candidate-1** 为 key image（Checkpoint A 批准候选）。若采用，art-bible.json 的 palette 应从本图主色提取（暖木棕系＋红 #B03A2A 级＋金/灯火点缀色），style_block 以「水彩＋彩铅手绘、Q 版 2 头身、暖木色客栈、红金点缀」为核心句
- 附注（非本次要点但为下一步义务）: design/art-bible.md / design/art-bible.json / design/assets.md 均未产出。key image 批准后 art-director 必须按 assets-config.md 风格一致性协议导出 art-bible.json（Primary=openai:gpt-image-2，`style_codes` 记 `[]` 即可，`palette`/`style_block`/`resolution` 必需）

## 处理记录（art-director — key image 排序的落实）

- 日期时间: 2026-09-03T05:46:57Z（`date -u` 实测）
- 排序结论已采纳: candidate-1 → key image 批准候选。design/art-bible.md 与 design/art-bible.json 已按「风格一致性协议」产出（Primary=openai:gpt-image-2 → `style_codes: []`、palette 为 candidate-1 实测主色 10 色: 背景系 #3C2410/#653917/#A76E3C/#CC935A + 点缀 #963A16/#C18E52 + 角色 #281D10/#F3BD7D/#2F433A + 亮部 #F0C182）。candidate-2〜4 保留于 art-bible.md「备选 key image」节供 Checkpoint A 替换。character_reference 暂为 null，Checkpoint A 批准后从 key image 裁出掌柜立绘导出

## AR-BIBLE iteration 1 — CONCERNS
- 日期时间: 2026-09-03T05:50:04Z（`date -u` 实测）
- 机器核对:
  - `state/asset-routing.json` 实测: `routes.image_sprite` / `image_background` = `openai:gpt-image-2`（plan_tier=relay、base_url slb-v1.api.fan/v1）→ art-bible.json `style_codes: []` 属正常，不作为缺陷（gates.md AR-BIBLE 要点1）
  - art-bible.json 必备键齐备: `style_block`（英文机械化、含调色板 hex/头身/光源/负面约束）、`palette`（10 hex）、`resolution` {sprite:1024, tile:128}、`reference_images`。JSON 与 art-bible.md 调色板表 10 色完全一致（逐 hex 比对）
  - key image（design/refs/key-image-candidate-1.png, 1536x1024）重测: MEDIANCUT 10 色主色全部为暖棕〜橙木系（#9B5321/#783B14/#5D3515/#A76C39/#704D2B/#4C2F16/#C1854B/#2E1C0C/#DFA768/#3A2B19），红 #963A16 系未进入前 10 主色＝「红为点缀、永不成基调」的宣言与实测一致；palette 各色以最近邻分配均在图中有实配（#2F433A 青绿 2.0%、#F3BD7D 肤色 2.0%、#F0C182 灯火 0.7% — 小面积点缀/角色色，符合预期）
  - key image 目视: 水彩＋彩铅纸纹、暖木客栈、红灯笼/红毯为点缀、Q 版 2 头身 4 名伙计轮廓表情可辨 — 与风格宣言、P-01/P-02/P-04 的一致性成立
- 问题摘要（按优先级）:
  1. **玩家方识别色方针与 key image 实图矛盾（要点2/3）** — art-bible.md「轮廓方针」与 style_block 均规定「玩家方（掌柜＋伙计）服装主色＝青绿 #2F433A」「客人无青绿」，但 key image 实图为 青袍掌柜／**蓝白跑堂**／粉裙扫地姑娘 的多色伙计服装（art-bible.md 自己也如此记载）。style_block 是无 seed 的 gpt-image-2 路径唯一的一致性手段，照此前置会把全部伙计生成成青绿单一服色，与已批准候选图的角色多样性冲突；不前置则「青绿=玩家方」的秒单位识别规则失去机械依据。二选一修正: (a) 识别色改为「玩家方＝青绿/蓝/粉的低饱和冷色系 vs 客人＝暖色系」并把 style_block 的 "staff wear teal-green (#2F433A)" 改写为对应表述，或 (b) 维持青绿单一识别色，但明记生成资产将从 key image 的多色服装统一为青绿系（并在 Checkpoint A 披露差异）。需在 assets.md 各伙计资产提示词定稿前解决
  2. **描边宽度规格与缩小倍率未对齐（要点3 生成可复现性）** — style_block 规定 "clean 1-2px dark ink-brown outlines"，但该 1-2px 未注明是哪个分辨率的像素。精灵按 1024x1024 生成、游戏内显示 64〜96px（道具/菜品图标）＝约 10〜16 倍 linear 缩小，生成图上的 1-2px 描边缩到 0.1〜0.2px，实质消失，与「全部交互对象带 #281D10 描边」的前景保障方针自相矛盾。修正例: 明记「描边宽度以 1024 画布计 8〜12px（缩至 96px 显示时等效约 1px）」这类按生成分辨率换算的指定，并同步改写 style_block
  3. **（非缺陷、义务确认）`character_reference: null`** — art-bible.md 已记载 Checkpoint A 批准后由 art-director 裁出掌柜立绘存 `design/refs/character-ref.png` 并更新 json。此为批准后的必办事项，遗漏将导致 hero 系列姿势一致性失去唯一锚点（gpt-image-2 无 seed）。予以保留记录
  4. **（非缺陷、顺序确认）design/assets.md 尚未产出** — 要点4 的「与 assets.md 一致性」本次无法核对。concept-design.js 的流程为 ArtBible 审查 → art-director 创建 assets.md 骨架，属预期顺序；assets.md 中的尺寸/透明方针（1024 sprite、128 tile、Alpha 必需）须与本文件的「分辨率与瓦片尺寸」节一致，届时由 AR-ASSET 批次核对承接
- 处理:
  - 日期时间: 2026-09-03T05:51:53Z（`date -u` 实测）
  - 问题1（玩家方识别色 vs key image 多色服装）→ **已处理，采用修正案 (a)**。识别色改为「玩家方＝低饱和冷色系（每名伙计一个不同冷色: 青袍掌柜 #2F433A＝锚点色、蓝白跑堂、粉裙扫地姑娘）vs 客人＝暖色系（木棕/朱红/赭石，禁冷色服装）」的色温二分规则，与 key image 实图完全一致、无需把伙计统一为青绿单色（不在 Checkpoint A 披露任何差异）。理由: (a) 保住了「青绿 #2F433A＝玩家系锚点色」的秒单位识别依据（掌柜/UI 强调仍锁定该 hex），同时把规则泛化到色温二分使其对 4 名伙计的多色服装都成立; (b) style_block 是无 seed 路径唯一一致性手段，照旧前置会强制全部伙计生成青绿单色，与已批准候选图冲突。修改点: art-bible.json `style_block`（"staff wear teal-green (#2F433A)" → "Player-side inn staff wear low-saturation COOL-toned clothing, a different cool color per staff member (teal-green #2F433A for the innkeeper, indigo blue, dusty rose); guests wear warm browns, reds and ochres, never cool-toned clothing"）、art-bible.md「轮廓方针」玩家方/客人两条目、调色板表 `#2F433A` 行（「伙计主青绿＝玩家系识别色」→「伙计锚点青绿＝识别色锚点、规则为色温二分」）。palette 10 hex 未变更（无需新增色 — 冷色系的蓝/粉为小面积服装色，落在 palette 允许的 ±12%/通道生成噪声与小面积点缀范围内，识别依据是色温对比而非特定 hex）
  - 问题2（描边宽度与缩小倍率）→ **已处理**。描边规格改为「按 1024px 生成分辨率计 8〜12px（缩至 96px 显示等效约 1px、64px 图标约 0.5〜0.75px）」，并明记禁止以 1024 画布上的 1〜2px 细线生成。修改点: art-bible.json `style_block`（"clean 1-2px dark ink-brown outlines" → "bold dark ink-brown outlines (#281D10), stroke width 8-12px measured on the 1024px generation canvas (equivalent to about 1px when the sprite is displayed at 96px in game, so outlines must stay clearly visible after downscaling)"）、art-bible.md「风格宣言」第 1 段。「全部交互对象带 #281D10 描边」的前景保障方针自此与缩小倍率自洽。生成时将按此在 AR-ASSET 抽查缩小后描边残存（96px 显示宽度下目视）
  - 问题3（`character_reference: null`）→ **暂不处理（保留为批准后必办事项）**。理由: character_reference 必须从**已被人类批准**的 key image 裁出，Checkpoint A 批准前裁剪会锚定到未批准图像; art-bible.md「机器可读风格锁定」表已记载批准后裁出掌柜立绘存 `design/refs/character-ref.png` 并更新 json 的必办流程，本 iteration 不变更
  - 问题4（design/assets.md 未产出）→ **暂不处理（预期顺序）**。理由: 流程为 AR-BIBLE 审查 → art-director 创建 assets.md 骨架; 本修订未变更分辨率/透明方针（sprite 1024、tile 128、Alpha 必需均维持原值），assets.md 将按修订后的 art-bible 起草，一致性由 AR-ASSET 批次核对承接

## AR-BIBLE iteration 2 — APPROVE
- 日期时间: 2026-09-03T05:55:26Z（`date -u` 实测）
- 机器核对（本次实测）:
  - iteration 1 修订落实确认: art-bible.md「轮廓方针」与 art-bible.json `style_block` 均已改为「玩家方＝低饱和冷色系（掌柜 #2F433A＝锚点＋蓝白跑堂＋粉裙扫地姑娘）vs 客人＝暖色系」的色温二分规则（问题1 修正案 (a) 已落实，与 key image 实图的多色伙计服装一致）; 描边规格已改为「按 1024px 生成分辨率计 8〜12px（96px 显示等效约 1px、64px 图标约 0.5〜0.75px）」并明记禁止 1〜2px 细线生成（问题2 已落实，style_block 与风格宣言两处同步）
  - `state/asset-routing.json` 实测: `routes.image_sprite` / `image_background` = `openai:gpt-image-2`（plan_tier=relay）→ `style_codes: []` 属正常，不作为缺陷（gates.md AR-BIBLE 要点1）
  - art-bible.json 必备键齐备: `style_block`（含画风/头身/描边宽度换算/调色板 hex/光源/色温二分识别规则/负面约束的机械可执行指定）、`palette`（10 hex）、`resolution` {sprite:1024, tile:128}、`reference_images`、`character_reference`（null＝批准后裁出的既定流程）。JSON 与 art-bible.md 调色板表 10 hex 逐一比对完全一致
  - key image（design/refs/key-image-candidate-1.png, 1536x1024）重测: Pillow MEDIANCUT 10 色主色全部为暖棕〜橙木系（#603716 14.3% / #4A321A 12.2% / #7A3D15 11.8% / #36210E 10.5% / #8D5222 10.0% / #A86E3B 9.7% / #724F2D 8.9% / #C1854D 8.8% / #AA5721 7.9% / #DFA769 5.9%）— 红 #963A16 与青绿 #2F433A 均未进入前 10 主色＝「红与哑金只作点缀、永不成基调」的宣言与实测一致。palette 各色以最近邻主色分配: 背景系 5 色 dist ≤22（#3C2410→7、#653917→5、#A76E3C→1），点缀/角色小面积色 dist 28〜45（#2F433A→45、#F0C182→40）＝图中实配面积小所致，符合「锚点色/高光为小面积」的预期
  - key image 目视（Read 实视）: 水彩＋彩铅纸纹、暖木客栈、红灯笼/红毯/红甲为点缀、青袍掌柜/蓝白跑堂/粉裙扫地姑娘/红甲食客 4 名 Q 版 2 头身轮廓与表情可辨、光源为灯笼暖光 — 与风格宣言、P-01（亮度梯度可表达晨/日/夜）、P-02（干净轮廓利于程序化差分）、P-04（单画面俯视构图）一致
- 要点逐项判定:
  1. 风格锁定的机器可读性 — 合格（style_block 为每句可机械执行的指定＋palette 10 hex＋resolution; Primary=openai:gpt-image-2 → style_codes: [] 正常）
  2. 游戏内可辨识性 — 合格（色温二分＋描边/明度带分离方针具体到 hex 与阈值 0.85/0.15; 警告色与点缀色同 hex 的冲突已用「叠加 #F0C182 闪烁或描边加粗」消解）
  3. 生成可复现性 — 合格（无 seed 路径的最大风险已由「描边宽度按生成分辨率换算＋调色板 hex 内嵌 style_block＋背景变体经 /v1/images/edits 传调色板参考图＋character_reference 共用」覆盖; 允许 ±12%/通道生成噪声的验收阈值已定义）
  4. 技术一致性 — 合格（canvas 1280x720 与 tech-stack.md Phaser.Scale.FIT 一致; sprite 1024/tile 128/Alpha 必需与 assets-config.md 一致; engine=phaser 无 3D 方针要求。design/assets.md 尚未产出＝concept-design.js 的既定顺序〔ArtBible phase 审查 → Assets phase 起草〕，其尺寸/透明方针一致性由 AR-ASSET 批次承接核对）
- 问题摘要: （无 — APPROVE）
- 处理:
