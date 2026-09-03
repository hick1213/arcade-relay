# Conventions — 江湖客满（本游戏专有代码规范）

> 叠加在 `.claude/docs/tech-stack.md` 代码规范（7 条）之上。本文件只写本游戏特有追加规则。

## 命名

- systems 模块文件名 = gdd「系统一览」的模块名（`dayCycle.ts` `assignment.ts` …），小驼峰，与 GDD 一一对应（防规格漂移）。
- 常量名 = GDD 数值表的常量名原样（`DAY_SERVICE_DURATION_S` `TRAINING_SLOTS` …），集中在 `src/config.ts`，按 GDD 表格分组注释。
- Scene 类名 = `BootScene` 等 5 个固定名，scene key 为 `'Boot'` `'Title'` `'Menu'` `'Game'` `'Result'`。
- 资产键 = `ASSET_KEYS` 内按用途命名（`backgrounds.innHallMorning` `sprites.staffAFu` `audio.sfxUiTap` 等），不使用 IMG-xx 编号作键名（编号是设计侧 ID，运行时用语义键）。

## 类型设计

- SaveData / RunResult / 语义化输入事件等跨层类型定义在 `src/types.ts` 或 `systems/meta/metaTypes.ts`，一处定义、多处 import，禁止结构重复声明。
- `systems/` 的公开函数保持纯（输入值→返回值），状态容器（如 dayCycle 的相位状态）以不可变更新或单一持有者类实现。
- 事件卡、伙计、菜品等数据表用 `as const` 字面量表 + 派生类型，i18n 文案表 key 与之对齐。

## 本游戏特有规则

1. **单画面原则** — 禁止新增 Phaser Scene（5 个必需场景之外）。晨/日/夜、志向选择、终战演出全部在 GameScene 内以 `dayCycle` 状态机切换。
2. **纯点击** — 交互只允许 `pointerdown` 单次触发；禁止 drag/长按/键盘必需操作；可点击判定区 ≥ `BUTTON_MIN_SIZE_PX`（P-04）。
3. **delta 驱动相位** — 耐心倒计时、制菜、伙计移动全部以 ms `delta` 累计，禁止 `setInterval`/帧数计数。日间唯一硬计时为 `DAY_SERVICE_DURATION_S`。
4. **文案零硬编码** — 任何玩家可见文本必须经 `systems/i18n/` key 查表（5 语言齐备义务在 build 阶段完成，prototype 至少中文全量）。console 输出仅允许诊断（i18n 缺 key warn 1 次、`[SaveCorruption]` error）。
5. **持久化单一入口** — `localStorage` 仅 `persistence/SaveAdapter` 引用；测试注入内存 Storage mock，禁用真实 localStorage。
6. **程序化差分不改资产** — P-02 成长差分用 tint/缩放/表情贴片/速度参数实现，禁止为差分新增图像文件（30 图上限满额）。
7. **优先级仲裁在 input 层** — 点击命中优先级（暂停面板 > 事件卡 > 出餐口 > 收钱 > 点单桌）只在 `systems/input/` 实现，业务系统不感知。
8. **音频播放** — 首次用户输入时 `sound.unlock()`；BGM/SFX 音量只经 SaveData.settings 的 `bgm_volume`/`sfx_volume` 控制（设置 UI 与实际输出必须接线，QA 验证项）。
