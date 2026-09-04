# ArcadeRelay 技术栈规范（game/ 下、engine=unreal 的权威来源）

> 引擎选择见 contract.md §11（`state/engine.txt`）。本文件是 **engine=`unreal`（3D）** 的权威来源。
> phaser 见 tech-stack.md，unity 见 tech-stack-unity.md。共通思想（禁止魔法数字 / delta-time / 引擎无关核心 / 输入抽象化 / 资产键集中）在全部引擎中相同，这里将其翻译为 UE C++ 惯用写法。

## 技术栈（固定）

- **Unreal Engine 5.x（推荐 5.8 以上）** + **C++** + **Enhanced Input** + **Automation Test**
- **禁止把逻辑放在 Blueprint 中**（.uasset 为二进制，文本 agent 无法读写、无法差分评审）。仅允许 UI widget 的接线等最低限度内容，逻辑必须放在 C++
- macOS 上必须有 Xcode 15.2 以上（C++ 编译）
- `game/` 是自包含 UE 项目。项目名**固定为 `ForgeGame`**（contract §11。`game/ForgeGame.uproject` 是标记）
- 引擎实体使用 preflight 在 `state/engine-info.json` 中解析出的路径（`UE_ROOT`）。**禁止在执行过程中重新解析**

## 引擎安装（安装状况的前提）

- 无论哪种途径获取引擎，都**必须有 1 次 Epic 账号的浏览器登录**（无法完全无人化）:
  1. **Offline Installer（推荐）**: 登录 dev.epicgames.com/portal 下载 macOS 用 `.pkg` → 之后用 CLI: `sudo installer -pkg FullInstall_OnMac.pkg -target /` → `sudo chown -R $USER "/Users/Shared/Epic Games/UE_"*`
  2. GitHub 源码构建: 需要 Epic⇔GitHub 关联（GUI＋接受邀请邮件），且需要超过 150GB 磁盘，因此**在本环境分类中不推荐**
- 磁盘要求: 引擎本体最少 30～40GB，含安装临时展开可能超过 100GB（无官方确定值）。**preflight 检查剩余空间，不足时上报给人类**
- 已安装确认: `ls "/Users/Shared/Epic Games/UE_"*/Engine/Build/BatchFiles/RunUAT.sh`

## 项目生成（scaffold）

不存在官方的 CLI 项目生成命令。使用**复制模板目录的方式**（与官方模板机制一致）:

1. 把 `$UE_ROOT/Templates/TP_ThirdPerson`（第三人称 3D。C++ 版）复制到 `game/`
2. 把 `.uproject` 重命名为 `ForgeGame.uproject`，将内部的 module 名、`Config/DefaultGame.ini` 的 `ProjectName` 更新为 `ForgeGame`
3. 把 `Source/` 下的模块名、类前缀统一为 ForgeGame
4. 把 Python Editor Script Plugin 添加到 `.uproject` 的 Plugins 依赖（用于 headless 自动化）

## 目录结构

```
game/
  ForgeGame.uproject
  Source/
    ForgeGame/
      ForgeGame.Build.cs
      GameConfig.h            # ★全部游戏参数（namespace GameConfig / constexpr）+ 资产路径常量
      Types.h                 # 共享类型（FEntityState 等）
      Systems/                # 引擎无关逻辑（pure C++。禁止 UObject/AActor，FVector 等核心类型允许）
        Meta/                 # 元进度逻辑（MetaTypes.h / MetaSchema / MetaProgression — pure C++、contract §11）
      Persistence/            # 持久化 I/O 层（USaveGame 派生、SaveGameToSlot/LoadGameFromSlot 的唯一放置处。UObject 允许）
      Actors/                 # AActor/UObject 派生（仅生命周期与接线）
      Input/                  # Enhanced Input 的集中（PlayerController / 输入组件）
      Ui/                     # HUD（尽可能 C++。Widget BP 仅接线）
    ForgeGameTests/           # Automation Test 模块（IMPLEMENT_SIMPLE_AUTOMATION_TEST）
  Content/
    Generated/                # AI 生成资产的导入目标（经 Interchange 导入的 .uasset）
    Maps/                     # Boot/Title/Menu/Game/Result 5 个状态（contract §11 必需场景集合。关卡拆分或状态切换均可 — 但 5 个状态的全部实在与切换必须可用 Automation 测试验证。不允许「单一关卡所以省略 Title/Menu」）
  Config/
    DefaultEngine.ini / DefaultGame.ini / DefaultInput.ini
  _generated/                 # raw 生成资产 + MANIFEST.jsonl（Content/ 外 = UE 不会导入）
```

版本管理排除（已 .gitignore）: `Binaries/ Intermediate/ Saved/ DerivedDataCache/`。`Source/ Config/ Content/ *.uproject` 为提交对象（Content/ 的 .uasset 是二进制）。

## 验证命令

`UE_ROOT` 是 `state/engine-info.json` 的 `ue_root` 字段（`/Users/Shared/Epic Games/UE_5.x` 形式。由 preflight 写出）。`binary` 是 `RunUAT.sh` 的完整路径，在没有 `ue_root` 的旧文件中从 binary 向上回溯 3 层（`Engine/Build/BatchFiles`）导出。

| 目的（对应 phaser） | 命令 | 合格条件 |
|---|---|---|
| 相当于 typecheck/build（编译） | `"$UE_ROOT/Engine/Build/BatchFiles/RunUAT.sh" BuildCookRun -project="$PWD/game/ForgeGame.uproject" -platform=Mac -architecture=arm64 -clientconfig=Development -build` | exit 0 |
| test（QA 用） | `"$UE_ROOT/Engine/Binaries/Mac/UnrealEditor-Cmd" "$PWD/game/ForgeGame.uproject" -ExecCmds="Automation RunTests ForgeGame;Quit" -ReportExportPath="$PWD/qa/evidence/automation" -unattended -nopause -nullrhi -stdout` | exit 0 且报告 JSON 中 failed 0（`-unattended -nullrhi` 系标志不在官方文档内，须以实机验证确定） |
| 相当于 package（完整构建） | `"$UE_ROOT/Engine/Build/BatchFiles/RunUAT.sh" BuildCookRun -project="$PWD/game/ForgeGame.uproject" -platform=Mac -architecture=arm64 -clientconfig=Development -build -cook -stage -pak -archive -archivedirectory="$PWD/game/Build"` | exit 0（`BUILD SUCCESSFUL` 日志） |
| 相当于 dev/preview（面向人类） | `open "game/Build/Mac/ForgeGame.app"`（已打包）或在 UE 编辑器中打开项目 | — |

编辑器自动化脚本使用 Python（`unreal` 模块），以 `UnrealEditor-Cmd <uproject> -run=pythonscript -script="script.py"` headless 执行。

**串行化与验证批处理化（Build/Polish 并行 lane 规范 — retro-e2 方案A+B）**: UE 的构建（UBT/UAT）与伴随编辑器启动的工序不在同一项目上并行（构建中间物、编辑器锁会冲突）。代码 story 的实现在 assignee lane（gameplay/ui）中并行，因此**lane 中的 agent 一律不启动 UE/UBT**。每个 story 的验证止步于「用 Read/Grep 静态确认所引用的类型、成员、头文件 include 的实际存在」，BuildCookRun 的一次性验证在**lane 合流后的批处理验证区间（串行）**进行。失败时用错误的文件路径和 `git log --oneline -- <path>` 定位原因 story（困难时按 story 提交单位二分查找），并把最小修复与原因 story 记录到 `state/reviews/batch-verify.md`（权威实现是 workflow 的 batchVerify）。

## 代码规范（rules/unreal-code.md 在编辑时强制执行的内容的权威来源）

1. **禁止魔法数字** — 全部游戏参数集中在 `Source/ForgeGame/GameConfig.h` 的 `namespace GameConfig` 内的 `constexpr` 常量。调参只在 GameConfig.h 中完成
2. **必须使用 delta-time** — 用 `Tick(float DeltaSeconds)` 的 `DeltaSeconds` 缩放。禁止以固定帧率为前提的实现
3. **Actors 保持轻薄** — AActor/UObject 派生只负责生命周期与接线。逻辑放入 `Systems/` 的 pure C++（禁止 UObject/AActor/UWorld。`FVector`/`FMath` 等核心类型允许）
4. **禁止 Blueprint 逻辑** — 游戏规则、状态切换、数值计算不放在 Blueprint 中（二进制无法评审）。Widget BP 仅做显示接线
5. **输入抽象化** — 统一到 Enhanced Input（`UInputAction`/`UInputMappingContext`）。禁止旧 `BindAxis("字符串")`
6. **资产引用键集中** — 动态加载经由集中在 `GameConfig.h` 的 `FSoftObjectPath`/`TSoftObjectPtr` 常量。禁止在实现正文中直接写路径字符串
7. **测试必需** — 用 `IMPLEMENT_SIMPLE_AUTOMATION_TEST` 放置至少 1 个验证相当于核心循环（Systems 层的状态切换 1 周）的测试
8. **场景/状态集合固定** — Boot / Title / Menu / Game / Result 5 个状态（contract §11 必需场景集合。正规流程: Boot→Title→Menu→Game→Result→{Game|Menu}）。Menu 的必需要素: 开始游戏、游戏外显示（解锁/成就/统计）、设置（音量、操作说明）、退出入口。5 个状态的实在与切换用 Automation 测试验证
9. **持久化 I/O 集中在 `Source/ForgeGame/Persistence/`** — `USaveGame` 派生类、`UGameplayStatics::SaveGameToSlot/LoadGameFromSlot` 仅限此层（因为是 UObject 派生，不能放在 Systems/）。元进度逻辑（`Systems/Meta/` 的 pure C++、`FMetaSaveData` 等纯 struct）只接收值并返回值，`FMetaSaveData` ⇔ `UForgeSaveGame` 的 UPROPERTY 转换是 Persistence 层的责任（参见「存档 / 持久化」节）

## 资产处理

- raw 生成物与 MANIFEST.jsonl 放在 `game/_generated/`（contract §6/§11）。导入用 Python 自动化 Interchange Framework（UE5 原生支持 glTF/FBX）: 用 `unreal.InterchangeManager` 导入并存放到 `Content/Generated/`
- **尺度单位是最大的陷阱**: UE 是 1 unit = 1cm，glTF 以 m 为基准。导入后检查包围盒（人形 ≈ 160–200 units），偏离时应用 Import Uniform Scale=100 或在 raw 侧烘焙修正
- 带 rig 的角色: 推荐 FBX（2020 系格式）。重定向用 Python API（`unreal.IKRetargeterController` / `auto_map_chains(FUZZY)`）自动化 IK Rig / IK Retargeter
- 音频: 以 WAV 导入（UE 原生）。不需要 OGG/M4A 双路冗余（phaser 专属要求）

## QA-PLAY 的执行方法（由 gates.md QA-PLAY 的 unreal 节引用）

1. 相当于 package 的命令 exit 0
2. 用 Automation Test 验证核心循环 1 周＋**必需场景切换 `Title → Menu → Game → Result → Menu` 的 1 周**（Systems 层＋Functional Test）。用 `-ReportExportPath` 的 JSON 机器验证 failed 0
3. 截图证据: 用 Automation 的 screenshot 功能或在 ExecCmds 中发出 `HighResShot` 控制台命令，保存到 `qa/evidence/`（使用 `-nullrhi` 时无法绘制，因此获取截图时务必去掉 nullrhi）。拍摄的成败先做机器判定: `magick identify -format "%[fx:mean]" <shot>.png` 低于 0.02/超过 0.98 视为 SUSPECT_BLANK，修正拍摄条件后重新拍摄。**拍摄的图像必须用 Read 目视，确认对象（模型、UI 文字）确实被拍到**（黑屏、绘制缺失为不合格。仅靠值的内部一致性测试无法检测渲染缺陷 — 与 unity 节相同的纪律）
4. acceptance 将 stories.yaml 的各项作为 Automation Test 实现并执行
5. **元进度的持久化测试（必需）**: 按 gates.md QA-PLAY 要点5，用 Automation 测试验证保存→重新加载后恢复一致，以及损坏的 `.sav` 触发 `.bak` 备份保存＋`[SaveCorruption]` 错误（用 `AddExpectedError(TEXT("SaveCorruption"))` 白名单检测）＋默认值恢复。测试使用专用槽位名（例 `ForgeGameSave_Test`）并在末尾删除（「存档 / 持久化」节）

## 许可注意（EULA）

- 版税: 每个产品终身总营收超过 $1,000,000 USD 的部分收取 5%（在 Epic Games Store 同步上线则为 3.5%）
- **EULA 禁止把引擎代码、内容用于生成 AI 的训练、提示词输入**（不得将 Licensed Technology 输入 Generative AI Program 的义务）。harness 的 agent **不得读取 UE 引擎源码（`/Users/Shared/Epic Games/` 下）并包含到提示词中**。自己的项目（game/ 下的自作代码）不在此限
- 不可公开发布包含 Engine 代码的仓库（仅限 Engine Licensee 范围内分发）

## 存档 / 持久化（contract §6 存档规范的 unreal 实现权威来源）

- **保存位置**: `USaveGame` 派生 `UForgeSaveGame`（槽位名固定为 `ForgeGameSave`。实体为 `Saved/SaveGames/ForgeGameSave.sav`）。以 `UPROPERTY() int32 SaveVersion` 作为必需的首字段
- **层的分离**（contract §11）: 元进度逻辑 = `Source/ForgeGame/Systems/Meta/`（pure C++。`FMetaSaveData` 等纯 struct + 接收 RunResult 并返回新 SaveData 的纯函数群）。I/O = `Source/ForgeGame/Persistence/`（`UForgeSaveGame` 与 `MetaSaveService`: `TryLoad(FMetaSaveData&)` / `Save(const FMetaSaveData&)` / `BackupCorruptSlot()`。仅做 `FMetaSaveData` ⇔ UPROPERTY 的 1:1 转换）
- **迁移**: `SaveVersion` 较旧时依次应用 v(n)→v(n+1)。比当前版本更新的版本不做转换，按损坏处理（禁止隐式降级）
- **损坏时协议（禁止静默初始化 — rules/unreal-code.md 强制执行）**: 加载失败、`SaveVersion` 不正确、schema 验证失败（必需字段缺失、类型错误）中的任一情况，均 (1) 用 `IFileManager` 把 `.sav` 备份保存为 `.bak.sav` → (2) 执行 1 次 `UE_LOG(LogForgeGame, Error, TEXT("[SaveCorruption] reason=... backup=..."))` → (3) 以默认值重新生成并把 `bRecovered` 传递到 UI 层（Title/Menu）
- **保存时机**: 到达 Result 时 `ApplyRunResult` → 立即 Save 1 次。`UGameInstance` 适合作为 `MetaSaveService` 的调用方（跨关卡自然持久）
- **测试规范**: Automation 测试使用专用槽位名（`ForgeGameSave_Test` 等），并用 `IFileManager::Get().Delete` 在末尾清理。不在测试中使用正式槽位 `ForgeGameSave`

## 面向未来引擎无关化的边界划分

- `Source/ForgeGame/Systems/` 不 include UObject/AActor/UWorld（仅核心值类型允许）— 这里是引擎无关层（`Systems/Meta/` 同样）
- UE 依赖封闭在 `Actors/` `Ui/` `Input/` `Content/` `Persistence/` 中
