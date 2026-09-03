# Assets Manifest — 江湖客满

> 引擎: phaser（`state/engine.txt`）。生成规格的权威来源（「要做什么」）。生成实绩（provider/seed/cost/sha256）记录在 `game/assets/MANIFEST.jsonl`（「做了什么」）。
> 所有图像提示词在生成时**机械前置** `design/art-bible.json` 的 `style_block`（此处草案不重复抄写，只写主体/姿势/朝向等资产特有指定）。
> 图像 Primary 路由 = `state/asset-routing.json` 实测: `routes.image_sprite` / `routes.image_background` 均为 **`openai:gpt-image-2`**（基址 `OPENAI_BASE_URL` = `https://slb-v1.api.fan/v1`，OpenAI 兼容中转 packcode，`plan_tier: relay`）。本表「路由」列 `primary` 即指该路由。fallback 切换由 `state/asset-routing.json` 与 AR-ASSET 循环管理，此处不写。
> 一致性手段（gpt-image-2 路径特性）: 无 seed/style_codes — 靠 style_block 文本前置＋`/v1/images/edits` 传入调色板/风格参考图（`design/refs/key-image-candidate-1.png`）。角色系立绘在 `design/refs/character-ref.png`（Checkpoint A 批准后从 key image 裁出）就绪后统一经 `/v1/images/edits` 共用 character_reference。
> 透明方针: 精灵全部 `background:"transparent"` + `output_format:"png"`（transparent 为 preview 功能 — 中转可能丢参，生成后逐张做 alpha 机器验证，失败走 `bg_removal` 路由 `local:rembg-isnet-anime`）。背景/结局插画例外（opaque）。

## 图像

| id | 类型 | 文件名 | 尺寸 | P-xx | 提示词草案 | 路由 | 状态 |
|---|---|---|---|---|---|---|---|
| IMG-01 | background | tile-inn-hall-morning.png | 1536x1024 (opaque, cover 裁切至 1280x720) | P-01/P-04 | Elevated 3/4 top-down view of the interior of a cozy Chinese wuxia inn main hall in clear morning light: wooden service counter on the upper side, staircase, raised walkway, round wooden tables with stools evenly spread over the lower two-thirds as a playable floor, wine jars along walls, red carpet runner as accent, no people, calm and tidy, large uncluttered floor area, single-screen game board composition | primary | planned |
| IMG-02 | background | tile-inn-hall-day.png | 1536x1024 (opaque, cover 裁切至 1280x720) | P-01/P-04 | The exact same inn hall, same layout, same furniture positions, same camera angle as the reference image, but at busy midday: lanterns lit, warm bright candlelight tone, slight bustle marks (a steamer on the counter), still no people, identical playable floor area — generate via `/v1/images/edits` using IMG-01 as the reference image so the room layout stays pixel-consistent | primary | planned |
| IMG-03 | background | tile-inn-hall-night.png | 1536x1024 (opaque, cover 裁切至 1280x720) | P-01/P-04 | The exact same inn hall, same layout and camera as the reference image, but at evening close: warm lantern glow dominating, overall one step dimmer and cozier, long soft warm shadows, windows showing dusk, still no people — generate via `/v1/images/edits` using IMG-01 as the reference image; brightness must stay in the 0.2–0.75 band so interactive sprites stay readable | primary | planned |
| IMG-04 | sprite | sprite-staff-a-fu.png | 1024x1024 (游戏内显示 192–256px, linear 缩小) | P-02 | Single chibi 2-heads-tall young male inn waiter named A-Fu, full body standing, front 3/4 view, indigo-blue short jacket over white trousers (cool-toned clothing), a folded serving cloth over one forearm, slightly clumsy cheerful grin, big round eyes, simple rounded silhouette, one transparent-background isolated character, no ground shadow | primary | planned |
| IMG-05 | sprite | sprite-staff-tie-niu.png | 1024x1024 (同上) | P-02 | Single chibi 2-heads-tall stocky male inn cook named Tie-Niu, full body standing, front 3/4 view, slate-grey-blue apron over charcoal tunic (cool-toned clothing), thick arms, wide honest smile, small kitchen cleaver tucked in belt, rounded silhouette, isolated character, no ground shadow | primary | planned |
| IMG-06 | sprite | sprite-staff-wen-qu.png | 1024x1024 (同上) | P-02 | Single chibi 2-heads-tall slender male inn accountant named Wen-Qu, full body standing, front 3/4 view, teal-green long robe (#2F433A tone, cool-toned), holding a wooden abacus, thin mustache, clever narrow eyes, rounded silhouette, isolated character, no ground shadow | primary | planned |
| IMG-07 | sprite | sprite-staff-xiao-die.png | 1024x1024 (同上) | P-02 | Single chibi 2-heads-tall young female inn maid named Xiao-Die, full body standing, front 3/4 view, dusty-rose tunic with hair in two round buns, holding a small broom, shy soft smile, rounded silhouette, isolated character, no ground shadow | primary | planned |
| IMG-08 | sprite | sprite-staff-da-song.png | 1024x1024 (同上) | P-02 | Single chibi 2-heads-tall broad-shouldered male inn guard named Da-Song, full body standing, front 3/4 view, charcoal-blue martial tunic with simple shoulder guard (cool-toned), wooden staff in both hands, earnest bulky frame, rounded but sturdy silhouette, isolated character, no ground shadow | primary | planned |
| IMG-09 | sprite | sprite-staff-liu-biao-tou.png | 1024x1024 (同上。UNL-01 解锁伙计) | P-02/P-03 | Single chibi 2-heads-tall female escort captain named Liu-Biao-Tou, full body standing, front 3/4 view, steel-blue travel outfit with muted iron bracers (cool-toned), saber sheathed on back, confident stance, calm sharp eyes, rounded silhouette, isolated character, no ground shadow | primary | planned |
| IMG-10 | sprite | sprite-staff-su-yu-chu.png | 1024x1024 (同上。UNL-02 解锁伙计) | P-02/P-03 | Single chibi 2-heads-tall elderly male imperial chef named Su-Yu-Chu, full body standing, front 3/4 view, aubergine-plum chef robe with white kerchief (cool-toned), holding a long-handled ladle, thin white beard, serene proud expression, rounded silhouette, isolated character, no ground shadow | primary | planned |
| IMG-11 | sprite | sprite-guest-commoner.png | 1024x1024 (同上) | P-01/P-04 | Single chibi 2-heads-tall ordinary traveler guest, full body standing, front 3/4 view, plain ochre-and-tan commoner robe (warm-toned clothing only), straw hat held in hand, relaxed hungry expression, rounded silhouette, isolated character, no ground shadow | primary | planned |
| IMG-12 | sprite | sprite-guest-escort.png | 1024x1024 (同上) | P-01/P-04 | Single chibi 2-heads-tall jianghu escort (bodyguard) guest, full body standing, front 3/4 view, red-brown traveler robe with vermilion sash (warm-toned clothing), saber at hip, weathered confident face, rounded silhouette, isolated character, no ground shadow | primary | planned |
| IMG-13 | sprite | sprite-guest-gourmet.png | 1024x1024 (同上) | P-01/P-04 | Single chibi 2-heads-tall wealthy gourmet guest, full body standing, front 3/4 view, rich burgundy-and-gold-trim merchant robe (warm-toned clothing), round belly, holding chopsticks, fussy demanding expression, rounded silhouette, isolated character, no ground shadow | primary | planned |
| IMG-14 | sprite | sprite-rival-warlord.png | 1024x1024 (游戏内显示 ~320px) | P-02/P-03 | Single menacing jianghu rival warlord, chibi 2-heads-tall but angular and imposing, front 3/4 view, ink-black (#281D10) robe with vermilion red accents only, sharp angular silhouette contrasting with rounded inn staff, cold glare, arms crossed, isolated character, no ground shadow | primary | planned |
| IMG-15 | sprite | sprite-dish-01-noodles.png | 1024x1024 (游戏内显示 64–96px) | P-01/P-04 | Single small icon of a steaming bowl of hand-pulled noodle soup, cream porcelain bowl, 3/4 top-down view, one item centered, simple readable shape at small size, isolated item | primary | planned |
| IMG-16 | sprite | sprite-dish-02-buns.png | 1024x1024 (同上) | P-01/P-04 | Single small icon of a bamboo steamer with three white steamed buns, 3/4 top-down view, one item centered, simple readable shape, isolated item | primary | planned |
| IMG-17 | sprite | sprite-dish-03-chicken.png | 1024x1024 (同上) | P-01/P-04 | Single small icon of a glazed roasted chicken on a round ceramic plate, 3/4 top-down view, one item centered, simple readable shape, isolated item | primary | planned |
| IMG-18 | sprite | sprite-dish-04-tofu.png | 1024x1024 (同上) | P-01/P-04 | Single small icon of mapo tofu in a shallow clay pot, warm red-brown sauce, 3/4 top-down view, one item centered, simple readable shape, isolated item | primary | planned |
| IMG-19 | sprite | sprite-dish-05-fish.png | 1024x1024 (同上) | P-01/P-04 | Single small icon of a whole steamed fish on an oval ceramic platter with scallion garnish, 3/4 top-down view, one item centered, simple readable shape, isolated item | primary | planned |
| IMG-20 | sprite | sprite-dish-06-broth.png | 1024x1024 (同上。高级菜) | P-01/P-04 | Single small icon of an ornate golden-trimmed tureen of luxurious broth with a tiny ladle, subtly premium look, 3/4 top-down view, one item centered, simple readable shape, isolated item | primary | planned |
| IMG-21 | sprite | sprite-table-round.png | 1024x1024 (游戏内显示 ~160px, 程序化摆放 6 桌) | P-01/P-04 | Single round wooden inn table with 4 stools, 3/4 top-down view, warm wood tones, subtle grain, slightly worn top, no items on it, single object centered, isolated, no ground shadow | primary | planned |
| IMG-22 | sprite | ui-ambition-wealth.png | 1024x1024 (游戏内显示 64–96px) | P-03 | Single icon of a muted-gold sycee ingot (Chinese yuanbao) with soft candlelight highlight, front view, one item centered, simple readable shape at small size, isolated | primary | planned |
| IMG-23 | sprite | ui-ambition-xia.png | 1024x1024 (同上) | P-03 | Single icon of a sheathed jianghu sword crossed with a small wine gourd, muted steel and teal-green accents, front view, one item centered, simple readable shape, isolated | primary | planned |
| IMG-24 | sprite | ui-ambition-renown.png | 1024x1024 (同上) | P-03 | Single icon of a rolled paper scroll with a blank label and a small vermilion seal stamp, front view, one item centered, simple readable shape, isolated | primary | planned |
| IMG-25 | sprite | ui-event-card-frame.png | 1024x1536 (游戏内显示 ~400x600) | P-03 | A single vertical event card frame: warm paper texture border, vermilion corner ornaments and muted-gold trim, decorated top medallion of a lantern, large empty inner area for later text, no text anywhere, transparent inside the frame, flat front view | primary | planned |
| IMG-26 | background | tile-ending-wealth.png | 1536x1024 (opaque) | P-03 | Ending illustration, same inn hall at golden dusk overflowing with prosperity: chests, stacked silver, red lanterns doubled, chibi inn staff celebrating around the counter, warm triumphant mood, wide storybook composition | primary | planned |
| IMG-27 | background | tile-ending-xia.png | 1536x1024 (opaque) | P-03 | Ending illustration, the chibi inn staff standing together in the inn courtyard at dawn with swords shouldered, cool teal dawn sky kept outside the palette accents, quiet heroic mood, wide storybook composition | primary | planned |
| IMG-28 | background | tile-ending-renown.png | 1536x1024 (opaque) | P-03 | Ending illustration, the inn hall crowded with admiring guests and a red festival banner, the chibi staff proudly serving at the counter, bustling famous-teahouse mood, wide storybook composition | primary | planned |
| IMG-29 | sprite | ui-title-emblem.png | 1536x1024 (游戏内显示 ~640x427) | P-03/P-04 | Decorative title screen emblem for a wuxia inn management game: a lantern, the inn's tiled roof silhouette, wine jar and ink-brush flourish arranged around a large empty center area, no text anywhere, transparent background, horizontally wide composition | primary | planned |
| IMG-30 | sprite | ui-common-sheet.png | 1536x1024 (程序化网格切分) | P-04 | A sprite sheet laid out on an invisible regular grid on transparent background: 2 round wooden buttons (normal and pressed states), 1 parchment panel base, 1 ledger book icon, 1 silver ingot icon, 1 scroll icon, 1 small sword-icon chip, evenly spaced with clear margins between elements, no text, flat front view of each element | primary | planned |

### 生成注意事项（不进表格的横切方针）

- **数量**: 30 张（brief 上限 ≤30 的满额。gdd「登场实体一览」算式为 28 图＋余量 2 — 本清单将 art-bible.md「分辨率与瓦片尺寸」节确定的晨/日/夜 **3 张背景变体**逐张列出（IMG-01/02/03，比 gdd 表的 1 张多 2 张），恰好用满余量 2。**与 gdd 算式的此偏差已按「不改写 gdd」原则仅作报告，总数 30 仍在 brief 上限内**）
- **表情贴片**: art-bible.md「动画方针」提到的表情贴片（普通/忙碌/沮丧/得意）**不在本清单内**（图像上限已满额 30）。按 gdd「差分实现」方针以程序化差分（tint＋缩放＋代码绘制的眼/口贴片）承担；若 art-reviewer 判定必须生成立绘差分，则须先删减其他资产或由人类批准放宽上限
- **标题文字**: IMG-29 为**无文字的装饰 emblem** — 标题文字「江湖客满」由 Phaser Text 以 5 语言（i18n）在引擎侧渲染。理由: (1) style_block 负面约束 no text，(2) gpt-image-2 生成中文书法文字不可靠，(3) 5 语言 i18n 本来就要求文字引擎侧渲染。此为对 gdd「标题 logo」条目的实现解释，生成规格以本清单为准
- **IMG-30 的切分**: 单张 sheet 由代码按固定网格程序化切分（gdd「共通 UI sheet」方针）；提示词以「不可见规则网格＋留白」约束布局，生成后逐格验证非透明区域落在网格内
- **alpha 验证**: IMG-04～25、IMG-29、IMG-30 为透明精灵，生成后逐张机器验证 alpha 通道；IMG-01～03、IMG-26～28 为 opaque 背景/插画，不做 alpha 验证
- **路由备注**: `shippable: true`（state/asset-routing.json 实测）。图像 fallback 链经中转失败时仅剩 Ideogram 直连（无密钥，不可用）→ `local:placeholder-must-replace` — 生成失败会直接成为未解决事项，生成 lane 需对 429/5xx 做退避重试后再报失败

## 音频

> 路由（state/asset-routing.json 实测）: SFX = `elevenlabs:sfx-v2`（`POST /v1/sound-generation`、model `eleven_text_to_sound_v2`。**全部显式指定 `duration_seconds`** — 成本 5 倍差与时长不定防堵）、BGM = `elevenlabs:music-v2`（`POST /v1/music`、`composition_plan` 指定段落、`force_instrumental:true`、记录 seed）。`plan_tier: free`（preflight subscription 200 实测）→ MANIFEST 全行 `license_note: "elevenlabs-free-tier"`，Checkpoint 许可标记披露。fallback: SFX=`local:jsfxr`、BGM=`local:jsfxr-ambient-must-replace`（routing 表）。
> 后处理（assets-config.md「生成后流水线」）: `ffmpeg loudnorm`（-16 LUFS ±1）→ 静音裁切 → BGM 循环验证（小节边界交叉淡化 → 2 段拼接 → 接缝咔哒声/RMS 阶差扫描，不合格重新生成）→ phaser 交付格式 **OGG Vorbis 128–160kbps ＋ M4A/AAC**（Safari 用，两格式都必须存在）。

### 音频方向 Decision（audio-designer 裁定与依据）

- **流派**: 国风器乐（古筝/笛子主奏＋古琴拨弦＋轻木鱼/鼓组）— brief「音频方向」直接指定，不另议
- **调性（全 BGM 共通）**: **A 羽调五声音阶** — 两曲同调是风格一致性的最小锚点；紧张感不由变调承担，由 BPM/配器/鼓组承担
- **BPM（不共通固定）**: 日间 92 / 终战 132 — brief 直接要求「日间经营轻快、终战紧张」的对置，BPM 是该对置的最小实现手段；调性＋主奏乐器＋同一合成 plan 维持「同一张原声碟」的听感。此为对「全 BGM 固定 BPM」惯例的**有意例外**，依据记于此
- **SFX 质感**: 温软的木质/瓷器/铜钱/纸张敲击感，禁尖锐电子音（brief 指定）。SFX 无 seed → **共通质感词汇 block 前置，每个 SFX 生成 4 变体 → 游戏内语境（音量叠加/与 BGM 频谱冲突）选出最佳**，筛选理由逐条追加写入 MANIFEST
- **数量**: SFX 8 / BGM 2（brief 上限，满额不超）

### SFX（8 个。提示词生成时前置共通质感 block）

共通质感 block（机械前置于下表全部提示词）:
`Warm handcrafted Chinese wuxia inn atmosphere, soft woody and porcelain textures, muted bronze and paper, gentle room reverb, no sharp electronic sounds, no harsh digital clicks, single short foley sound, clean isolated recording`

| id | 用途 | 文件名 | 尺寸 (s) | P-xx | 提示词草案（前置共通 block） | 路由 | 状态 |
|---|---|---|---|---|---|---|---|
| SFX-01 | 共通 UI 点击／晨间岗位指派确认（两次点击的第二击。变调/音量差区分场景） | sfx-ui-tap | 0.6 | P-04 | Soft short wooden tap, knuckle knocking once on a warm wooden counter, dry and gentle, tiny cloth muffle | primary (elevenlabs:sfx-v2) | generated |
| SFX-02 | 晨→日相位迁移「开门营业」（P-01 呼吸感的开场重音） | sfx-door-open | 2.0 | P-01 | Heavy wooden inn door swinging open with a low creak and soft settling thud, faint distant courtyard birds, warm welcoming feeling | primary (elevenlabs:sfx-v2) | generated |
| SFX-03 | 日间点单气泡亮起／派空闲跑堂（引导视线的轻提示） | sfx-order-bubble | 0.8 | P-01/P-04 | Light bright porcelain ting like a small teacup lightly touched, followed by one soft wooden tap, attention-getting but gentle | primary (elevenlabs:sfx-v2) | generated |
| SFX-04 | 出餐口出菜／上菜动作完成（日间节奏的正反馈重音） | sfx-dish-serve | 1.0 | P-01 | Porcelain bowl gently set down on a wooden table, soft ceramic clack, warm and satisfying, no shatter | primary (elevenlabs:sfx-v2) | generated |
| SFX-05 | 收银两（桌上的银两气泡。财线的即时兑现反馈） | sfx-coin-collect | 1.2 | P-03 | Small handful of bronze Chinese coins and one silver ingot dropped onto a wooden counter, mellow metallic jingle quickly settling | primary (elevenlabs:sfx-v2) | generated |
| SFX-06 | 服务失败客人失望离店（声望 −2～−4 的负反馈。温和不刺耳） | sfx-fail-leave | 1.5 | P-01 | Disappointed low wooden stool scrape and a door closing softly, muted descending thud, gentle and wistful, not harsh | primary (elevenlabs:sfx-v2) | generated |
| SFX-07 | 夜间结算翻帐本＋事件卡「翻卡」（夜间仪式感的开始音） | sfx-abacus-ledger | 2.0 | P-03 | Wooden abacus beads clicking in one quick short sweep, ending with a paper ledger page flip, cozy nighttime accounting mood | primary (elevenlabs:sfx-v2) | generated |
| SFX-08 | 终战「开战」与各回合胜负判定／结局揭示（P-03 兑现时刻的仪式重音） | sfx-battle-gong | 2.5 | P-03/P-02 | Large Chinese bronze gong strike with slow warm decay, one wooden staff clash right at the start, tense and ceremonial | primary (elevenlabs:sfx-v2) | generated |

**非专用音效的复用映射**（8 个上限内覆盖全部 gdd 事件，生成数不增）:
修练完成= SFX-01 高音量＋升调变体 / 破产败局= SFX-06 低速变调 / 成就・解锁达成= SFX-05 短变体 / 事件卡选项确定= SFX-07 尾段纸页音单独截取 / 菜单确认= SFX-01。变调一律由 Phaser 侧 `detune`/rate 实现，不生成新文件。

### BGM（2 曲。均循环前提、`force_instrumental:true`、记录 seed）

BGM 共通 style block（机械前置）:
`Chinese traditional light instrumental, guzheng and bamboo dizi lead, soft guqin plucks, warm A minor pentatonic (A C D E G), storybook wuxia inn atmosphere, acoustic instruments only, no vocals, seamless loop`

| id | 用途 | 文件名 | 尺寸 (s) | P-xx | 提示词草案（前置共通 block） | 路由 | 状态 |
|---|---|---|---|---|---|---|---|
| BGM-01 | 日间经营主曲（兼 Title/Menu/晨间/夜间 — 全游戏基础氛围。日间 180s ≥ 曲长，循环播放） | bgm-inn-day | 72 | P-01/P-04 | Gentle cheerful guzheng arpeggios with a lilting bamboo dizi melody over it, light woodblock and soft drum keeping a relaxed 92 BPM working tempo, warm contented feel, steady groove designed to loop cleanly | primary (elevenlabs:music-v2) | planned |
| BGM-02 | 第 20 日夜终战（约 40s 演出＋重试时的待机。紧张版，与 BGM-01 同调异速） | bgm-final-battle | 48 | P-03/P-02 | Tense jianghu showdown: fast guzheng tremolo runs, sharp short dizi stabs, big taiko-style drums and low gong accents over the same pentatonic mode, driving dramatic 132 BPM, acoustic and cinematic, loops cleanly | primary (elevenlabs:music-v2) | planned |

### 音频生成注意事项（不进表格的横切方针）

- **成本概算**: BGM 2 曲计 120s ≈ **$0.30**（$0.15/分）；SFX 8 个合计 11.6s ≈ $0.02（量级估算，`cost_estimated: true`，MANIFEST 按实际转录）。音频合计 ≈ $0.32 ＋ 图像 $1.04 ≈ **$1.36 ≪ budget.txt $20**，无超预算风险
- **BGM 循环验证为交付条件**: 2 段拼接接缝扫描（咔哒声/RMS 阶差）不合格即重新生成，不降级交付（assets-config.md 硬性事项）。作曲提示词内也写入 `seams loop cleanly` 引导
- **音量统一**: 全部资产 loudnorm 后落在 -16 LUFS ±1，游戏内音量层级只靠 `BGM_VOLUME/SFX_VOLUME`（gdd 数值表 0.7/0.8）与复用变调调节，不再逐文件手调
- **autoplay 限制**: 音频均在首次用户输入后由 `sound.context.resume()` 启动（tech-stack.md 规范 6）— 实现是 engineer 侧职责，此处仅声明资产不依赖自动播放
- **降级路径**: SFX 生成失败 → `local:jsfxr`（公有领域、可发布）；BGM 失败 → `local:jsfxr-ambient-must-replace` 并在 MANIFEST 标 `must_replace: true` ＋上报未解决事项。Primary API 失败时先做退避重试并报告 HTTP 状态，不得直接跳到降级
- **许可披露**: ElevenLabs free 计划输出按项目决策（2026-09-03）允许发布；MANIFEST 全行 `license_note: "elevenlabs-free-tier"`、`plan_tier: "free"`，Checkpoint C 许可标记节披露

### 生成实绩（prototype 垂直切片、SFX-01～08、2026-09-03）

- **全部 8 个 SFX 已生成**（provider `elevenlabs:sfx-v2` REST 直连、39 次生成 ≈51s 音频、合计 cost ≈$0.08 估算）。每个资产 4 变体→实测（LUFS/True Peak/crest）筛选最佳，筛选理由逐条记录在 MANIFEST 的 `variant_selection.reason`
- **响度合规**: 全部 8 文件实测 -16 LUFS ±1 内（-15.9～-16.7）、TP ≤ -1.5 dBTP。注意: ffmpeg 8.0 的 `loudnorm`/`ebur128` integrated 测量对 <400ms 的 clip 不可靠（测得静音值）— 测量时须 `apad=whole_dur=2` 后进行；`loudnorm` linear 模式对短 clip 亦失效，因此本批改用「实测 gain + alimiter TP -1.5」方法（数值等效 -16 LUFS 目标）。后续批次沿用此方法
- **SFX-01 提示词修正**: 原提示词（knuckle knock）的 4 变体全部为纯脉冲（crest 19–27dB），在 TP -1.5 dBTP 约束下物理上不可能达到 -16 LUFS（上限 ≈-20.3）。再生成 4 变体同样结果后，改为木鱼（muyu）质感提示词，第 3 组中选出 crest 15.0dB 的合规变体。听感仍是「软木质 UI 点击」，与 brief 的「温软木质、禁尖锐电子音」一致 — 记录为对提示词草案的有意偏离（表内提示词保留原草案，实际生成 prompt 见 MANIFEST）
- **复用映射的变调基准**: 修练完成= SFX-01 升调、破产败局= SFX-06 低速、成就=SFX-05 短变体、事件卡确定=SFX-07 尾段、菜单确认=SFX-01（变调由 Phaser `detune`/rate 实现，不新增文件）— 方针不变
- **BGM（BGM-01/02）未生成** — 按 workflow 指示留到 Phase 3（循环验证为其交付条件）

## 汇总与预算

- 图像: 30 个（brief 上限 30 以内）/ SFX: 8 个 / BGM: 2 曲（brief 上限，满额不超 — 见「音频」节）/ 3D 模型: 0（phaser）/ 动画: 0
- 概算成本合计（图像部分）: 1024 档 23 张 x $0.03 ＋ 1536x1024 档 7 张 x $0.05 ≈ **$1.04**（官方分辨率档位估算，`cost_estimated: true`。中转方实际计费可能不同 — MANIFEST 按实际记录）。音频部分 ≈ **$0.32**（见「音频生成注意事项」的成本概算，`cost_estimated: true`）。图像＋音频合计 ≈ $1.36，远低于 `state/budget.txt` 上限 $20

## 缺失检查

- 必需字段核对（id / 尺寸 / 提示词草案 / 提供者路由 / P-xx 引用）: **全部 40 条目（IMG-01～30、SFX-01～08、BGM-01～02）齐备，无缺失**（音频的「尺寸」= 时长秒数；音频路由 = 「音频」节头部声明的 `elevenlabs:sfx-v2` / `elevenlabs:music-v2`，与各表「路由」列一致）
- ID 重号/重新编号: 无重号（IMG-01～30 连续、SFX-01～08 连续、BGM-01～02 连续）。与 git HEAD（`18a5ebf`）比对无 ID 变更，未发生重新编号
- 备注（非缺失、仅观察）: SFX/BGM 表的「文件名」列无扩展名（交付格式 OGG＋M4A 由「音频」节头部横切声明，实现侧按此补扩展名）；IMG-30 为单张 sheet（程序化网格切分），atlas JSON 由生成后流水线产出
