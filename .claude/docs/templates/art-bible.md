<!--
  模板: design/art-bible.md（输出位置固定为 contract.md §6 的此路径）
  producer: art-director / reviewer: art-reviewer（Gate: AR-BIBLE, MAX_ITER 3）
  角色: 人类可读的美术方针书。机器可读的风格锁定以 design/art-bible.json 为权威来源，
  本文件负责说明 json 各值的「意图」。不要对值本身做双重管理。
  撰写规则: 直接回应 AR-BIBLE 的4要点（机器可读性 / 游戏内可辨识性 / 生成可复现性 / 技术一致性）。
  仅有模糊形容词的指定（「可爱的感觉」等）不合格。完成时删除全部指引注释。
-->

# Art Bible — <游戏标题>

## 风格宣言

<!-- 用 3～5 句宣言风格。必须包含:
     (1) 是否为像素美术（与 brief.md 一致）
     (2) 画风的专有名词式参照（例: 「16bit 末期的街机 STG 风」）
     (3) 线条、上色、光源的处理（例: 「1px 黑色描边、赛璐璐上色、光源固定左上」）
     把此宣言机械化即为 art-bible.json 的 style_block。 -->

## Key Image

<!-- 在 Checkpoint A 获得人类批准的1张。记录路径及其生成信息。
     此后的全部资产都按与这1张的一致度评分（AR-ASSET）。 -->

- 路径: `design/refs/<文件名>.png`
- 生成: provider / model / seed / style_codes（与 art-bible.json 同值）
- 此图中获批准的要点: <构图、质感、颜色等的要点列表>

## 调色板

<!-- 推荐 8～16 色。必须分配角色（玩家系/敌人系/背景系/UI系/警告色）。
     hex 值须与 art-bible.json 的 palette 完全一致（不一致则 AR-BIBLE 不合格）。
     背景系与角色系分离明度带可提升轮廓可辨识性。 -->

| 角色 | hex | 用途备注 |
|---|---|---|
| 玩家主色 | `#RRGGBB` | |
| 敌人主色 | `#RRGGBB` | |
| 背景基调 | `#RRGGBB` | |
| UI/文本 | `#RRGGBB` | |
| 警告、伤害 | `#RRGGBB` | |

## 轮廓方针

<!-- 游戏是1个画面、以秒为单位的判断。明文化以下内容:
     - 仅凭「形状」区分玩家/敌人/障碍物/收集物的规则
       （例: 玩家=纵长、敌人=有棱角、收集物=圆形）
     - 缩小到游戏内显示尺寸也不会糊掉的最小细节单位
     - 前景相对背景的对比度保障措施（描边、明度差等） -->

## 分辨率与瓦片尺寸

<!-- 与 art-bible.json 的 resolution 一致，并附上意图。
     不得与 assets.md 的全部资产尺寸、tech-stack.md 的显示系统矛盾（AR-BIBLE 要点4）。 -->

- 精灵生成分辨率: <Npx>（游戏内显示: <Mpx>，缩小方式: <nearest / linear>）
- 瓦片尺寸: <Npx>
- 透明方针: 所有精灵必须带 Alpha 通道（禁止发布白背景 PNG — assets-config.md）

## 动画方针

<!-- 写明「动什么、不动什么」的取舍。
     - 需要动画的对象及帧数（例: hero 行走4帧，敌人仅2帧闪烁）
     - 精灵表的排列规范（横向排列、帧顺序）
     - 明确写出: 用代码替代的动作（tween 上下摇动、闪烁等）不制作动画资产 -->

## 3D 风格方针（仅 engine=unity/unreal。phaser 时整节删除）

<!-- 3D 版的技术一致性（AR-BIBLE 要点4 的 3D 对应）。必须包含:
     - 多边形预算: hero / prop / 环境 的 tri 上限（若偏离 assets-config.md 默认值则说明理由）
     - 纹理分辨率与 PBR 方针（例: 2048px、albedo+metallic-roughness / 平面单色）
     - rig 方针: 是否为人形，所需动画剪辑的词汇（idle/walk/run 等）
     - 概念图协议: 全部模型采用 key image 系列的概念图 → image-to-3D 的
       两段生成（assets-config.md「风格一致性协议（3D 补充）」）。
     - 缩放规范: 以 glTF=m 为基准、人形 1.6–2.0m。unreal 在导入时换算为 cm -->

- 多边形预算: hero <N> tri / prop <N> tri / 环境 <N> tri
- 纹理: <分辨率、是否 PBR>
- rig: <humanoid / quadruped / none> / 动画剪辑: <一览>
- 缩放: 1 unit = <m/cm>，hero 身高 <N>m

## 机器可读风格锁定（对 art-bible.json 的引用）

<!-- 值的权威来源是 design/art-bible.json。此处只写各键的意图。
     json 的键结构由 assets-config.md「风格一致性协议」固定:
     style_block / palette / style_codes / reference_images / character_reference / resolution -->

| art-bible.json 键 | 意图（为何是此值） |
|---|---|
| `style_block` | |
| `palette` | |
| `style_codes` | |
| `reference_images` | |
| `character_reference` | |
| `resolution` | |
