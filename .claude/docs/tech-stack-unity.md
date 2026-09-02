# ArcadeRelay 技术栈规范（game/ 下、engine=unity 的权威来源）

> 引擎选择见 contract.md §11（`state/engine.txt`）。本文件是 **engine=`unity`（3D）** 的权威来源。
> phaser 见 tech-stack.md，unreal 见 tech-stack-unreal.md。共通思想（禁止魔法数字 / delta-time / 引擎无关核心 / 输入抽象化 / 资产键集中）在全部引擎中相同，这里将其翻译为 Unity 惯用写法。

## 技术栈（固定）

- **Unity 6.3 LTS（6000.3.x）** + **URP** + **C#** + **Input System**（`com.unity.inputsystem`）+ **Unity Test Framework**（`com.unity.test-framework` 1.6）
- 渲染**固定为 URP**（Built-in 在 Unity 6 中已不推荐。HDRP 在 macOS/Metal 上无法光线追踪、设置分散，故不采用。URP 的设置集中在 1 个 URP Asset 中，便于代码管理）
- `game/` 是自包含 Unity 项目。使用的编辑器为 preflight 在 `state/engine-info.json` 中解析出的 `binary`（下称 `$UNITY`）。**禁止在执行过程中重新解析版本**
- 3D 资产导入: 静态模型用 **GLB（`com.unity.cloud.gltfast`）**，带 rig、动画的用 **FBX（原生 ModelImporter）**。glTFast 不支持 Humanoid Avatar，因此人形经由 FBX 设置 `ModelImporter.animationType = Human`

## 项目生成（scaffold）

```bash
UNITY="$(jq -r .binary state/engine-info.json)"
# 1) 查找 URP 系模板（优先顺序: Hub 管理下 → 编辑器捆绑内）
TPL="$(ls "$HOME/Library/Application Support/UnityHub/Templates"/com.unity.template.urp-blank-*.tgz \
        "$(dirname "$(dirname "$UNITY")")/Resources/PackageManager/ProjectTemplates"/com.unity.template.3d-cross-platform-*.tgz \
        2>/dev/null | sort -V | tail -1)"
[ -n "$TPL" ] && "$UNITY" -batchmode -quit -createProject "$PWD/game" -cloneFromTemplate "$TPL" -logFile -
# 2) 没有则生成空项目 → 在 Packages/manifest.json 中明确写出依赖 → 重启以导入
[ -z "$TPL" ] && "$UNITY" -batchmode -quit -createProject "$PWD/game" -logFile -
```

应用模板后的后处理: 删除 `SampleScene`，规范化为 Boot/Title/Menu/Game/Result 5 个场景，并用这 5 个场景重新构成 EditorBuildSettings（contract §11 必需场景集合）。`3d-cross-platform` 模板已捆绑 URP / Input System / Test Framework（通常只需追加 glTFast），`activeInputHandler` 默认为 Input System（new）。

必需包（在 `game/Packages/manifest.json` 的 dependencies 中明确写出。版本可交给编辑器推荐解析）:
`com.unity.render-pipelines.universal` / `com.unity.inputsystem` / `com.unity.cloud.gltfast` / `com.unity.test-framework`

无模板生成时，用编辑器脚本生成 URP Asset 并分配到 Graphics Settings，以此作为 scaffold 的完成条件。

## 目录结构

```
game/
  Assets/
    Scenes/                 # Boot / Title / Menu / Game / Result 5 个场景（contract §11 必需场景集合。与 gdd 的游戏流程一致）
    Scripts/
      GameConfig.cs         # ★全部游戏参数 + AssetKeys（路径字符串的唯一放置处）
      Types.cs              # 共享类型（EntityState 等）
      Systems/              # 引擎无关逻辑（pure C#。禁止 MonoBehaviour/场景 API/File I/O）
        Meta/               # 元进度逻辑（MetaTypes.cs / MetaSchema.cs / MetaProgression.cs — pure C#、contract §11）
      Persistence/          # 持久化 I/O 层（File I/O、persistentDataPath 的唯一放置处。禁止从 Systems/ 直接 I/O）
      Components/           # MonoBehaviour（仅生命周期与接线）
      Input/                # 输入集中（Input System。action 用代码生成）
      Ui/                   # HUD、菜单（uGUI/UI Toolkit）
      Editor/
        ForgeBuild.cs       # 构建、验证用 static 方法（-executeMethod 的入口）
    Resources/
      Generated/            # AI 生成资产的导入目标（从 raw 复制。Resources.Load 方式 —「资产处理」节）
    Tests/
      EditMode/             # 兼作编译验证的最小测试（必须放至少 1 个）
      PlayMode/             # 核心循环验证、持久化验证、截图获取测试
  Packages/manifest.json
  ProjectSettings/          # ProjectVersion.txt 是项目标记（contract §11）
  _generated/               # raw 生成资产 + MANIFEST.jsonl（Assets/ 外 = Unity 不会导入）
```

版本管理排除（已 .gitignore）: `Library/ Temp/ Logs/ UserSettings/ obj/ Build/`。`Assets/ Packages/ ProjectSettings/` 为提交对象。`.meta` 要提交（Visible Meta Files / Force Text 为默认）。

## 验证命令

`$UNITY` 是 `state/engine-info.json` 的 `binary`。**禁止同时使用 `-runTests` 与 `-quit`**（测试完成前编辑器就退出的已知问题）。

| 目的（对应 phaser） | 命令 | 合格条件 |
|---|---|---|
| 相当于 typecheck | `"$UNITY" -batchmode -projectPath game -runTests -testPlatform EditMode -testResults "$PWD/qa/evidence/editmode-results.xml" -logFile -` | exit 0 且结果 XML 中 failed 0（编译错误也会导致测试启动失败，因此兼作 typecheck） |
| 相当于 build | `"$UNITY" -batchmode -projectPath game -executeMethod ForgeBuild.BuildMac -quit -logFile game/Logs/build.log` | exit 0 且日志中有 `Build succeeded`。产出物 `game/Build/ForgeGame.app` |
| test（QA 用） | `"$UNITY" -batchmode -projectPath game -runTests -testPlatform PlayMode -testResults "$PWD/qa/evidence/playmode-results.xml" -logFile -` | exit 0 且 failed 0 |
| 相当于 dev/preview（面向人类） | `open -a "$UNITY_APP" --args -projectPath "$PWD/game"`（在编辑器中打开）或 `open game/Build/ForgeGame.app`（启动已构建产物） | — |

`ForgeBuild.BuildMac` 是 `Assets/Scripts/Editor/ForgeBuild.cs` 的 static 方法，调用 `BuildPipeline.BuildPlayer`（`BuildTarget.StandaloneOSX`、Apple silicon），失败时用 `EditorApplication.Exit(1)` 以非 0 退出。**`-executeMethod` 必须指定包含命名空间的完全限定名**（例: `ForgeGame.EditorTools.ForgeBuild.BuildMac`。放在 namespace 中时，裸名无法解析）。

**单实例锁（重要）**: Unity 对同一项目只能同时打开 1 个编辑器进程。**启动 Unity 的工序（测试执行、构建、编辑器脚本的资产导入）必须全部串行化**。在并行 lane 设计（Build∥AssetGen）中，AssetGen 侧止步于生成与 Unity 外的机器验证（gltf validate / Blender 检查），引擎导入在 Integrate 阶段（串行区间）进行。

**验证批处理化（Build/Polish 并行 lane 规范 — retro-e2 方案A+B）**: 代码 story 的实现在 assignee lane（gameplay/ui）中并行，因此**lane 中的 agent 一律不启动 Unity**（与上述锁冲突）。每个 story 的验证止步于「用 Read/Grep 静态确认所引用的类型、成员、资产键、序列化对象的实际存在」，EditMode+build 的一次性验证在**lane 合流后的批处理验证区间（串行）**进行。批处理验证失败时，用错误的文件路径和 `git log --oneline -- <path>` 定位原因 story（困难时按 story 提交单位二分查找），并把最小修复与原因 story 记录到 `state/reviews/batch-verify.md`。验证粒度变粗的取舍由这套定位规范来缓解（权威实现是 workflow 的 batchVerify）。

## 代码规范（rules/unity-code.md 在编辑时强制执行的内容的权威来源）

1. **禁止魔法数字** — 全部游戏参数集中在 `Assets/Scripts/GameConfig.cs` 的静态常量类。调参只在 GameConfig.cs 中完成
2. **必须使用 delta-time** — `Update()` 用 `Time.deltaTime`，物理用 `FixedUpdate()` + `Time.fixedDeltaTime`。禁止依赖帧率的实现
3. **Components 保持轻薄** — MonoBehaviour 只负责生命周期与接线。逻辑放入 `Systems/` 的纯 C#（禁止继承 MonoBehaviour、禁止 `GameObject.Find`/`Instantiate`/`GetComponent`。`Vector3`/`Mathf` 等值类型允许）
4. **输入抽象化** — 使用 Input System 并集中到 `Scripts/Input/`。禁止旧 `Input.GetKey`。action **用代码生成**（`new InputActionMap(...)` + `AddAction`/`AddBinding`。`.inputactions` JSON 的 schema 未公开，禁止直接编辑）
5. **资产引用键集中** — 动态加载的路径/地址经由 `GameConfig.cs` 的 `AssetKeys`。禁止 `Resources.Load("直接写字符串")`。Inspector 直接引用（SerializeField）允许
6. **场景构成固定** — Boot / Title / Menu / Game / Result 5 个场景（contract §11 必需场景集合。正规流程: Boot→Title→Menu→Game→Result→{Game|Menu}）。切换触发与 gdd 的游戏流程一致。Menu 的必需要素: 开始游戏、游戏外显示（解锁/成就/统计）、设置（音量、操作说明）、退出入口
7. **测试必需** — EditMode 至少 1 个（兼作编译验证），PlayMode 放置验证核心循环 1 周（开始→挑战→结果→重开）的测试
8. **PlayMode 的模拟输入发送必须使用 `InputTestFixture`** — batchmode 下 Game View 不持有焦点，原始的 `InputSystem.QueueStateEvent` 在默认设置（PointersAndKeyboardsRespectGameViewFocus）下会被静默吞掉，`InputAction` 侧不响应。scaffold 时就在 `Packages/manifest.json` 中追加 `"testables": ["com.unity.inputsystem"]`，从 PlayMode 的 asmdef 引用 `Unity.InputSystem.TestFramework` 并使用 `InputTestFixture`
9. **Components 的 Awake 接线陷阱** — 从测试中组装在 `Awake()` 中读取接线字段的组件时，以非激活状态生成 GameObject→注入字段→激活（延迟 `Awake()`）
10. **兼容占位符⇔真实模型的 Renderer 引用** — 禁止 `[RequireComponent(typeof(Renderer))]`（抽象类型无法自动附加、带 rig 的 FBX 中 SkinnedMeshRenderer 附在子节点上）。用 `GetComponentInChildren<Renderer>()` + null 检查引用
11. **batchmode 工具的失败必须提升到 exit code** — 用 `-executeMethod` 调用的编辑器脚本（构建、导入、场景接线）不得以 `Debug.LogError` + `return` 了结不可恢复的错误（batchmode 仍以 exit 0 退出 = harness 的成败判定会把失败误认为成功）。必须 throw 异常或用 `EditorApplication.Exit(1)` 以非 0 退出，且不得在损坏状态下保存场景/资产
12. **接线损坏在 Start 中 LogError 1 次** — Components 层「以 Editor 工具注入为前提」的字段为 null 时，不得每帧无声 return 隐藏，而要在 `Start()` 中输出 1 次 `Debug.LogError`（降级正当的情形在头部注释中文档化后用 LogWarning）
13. **动画切换用 AnimatorController 资产而非代码** — MDL 的动画切换（idle/run 等）用 `UnityEditor.Animations` API 从编辑器脚本生成 AnimatorController（states/transitions/threshold 条件。无需追加 asmdef 引用），代码侧只用 `animator.SetFloat` 传参数。**不要选到 Unity 自动生成的 `__preview__` 剪辑**（剪辑搜索时排除名称 `__preview__`）
14. **HUD/菜单的 Canvas 固定为 `RenderMode.ScreenSpaceCamera`** — QA-PLAY 的 RenderTexture 拍摄在结构上无法拍到 Screen Space - Overlay 的 Canvas（Overlay 不绑定特定相机，完全不会绘制到单相机的 RenderTexture 中）。全部 UI Canvas 设为 ScreenSpaceCamera 并把主相机分配给 `worldCamera`。在 PlayMode 测试中放置 `Assert.AreEqual(RenderMode.ScreenSpaceCamera, canvas.renderMode)` 的冒烟检查
15. **持久化 I/O 集中在 `Assets/Scripts/Persistence/`** — 不得从 Systems/、Components/、Ui/ 直接调用 `Application.persistentDataPath`、`File` I/O、`PlayerPrefs`。元进度逻辑（`Systems/Meta/` 的 pure C#）只接收值并返回值，保存、读取由 Persistence 层中介（参见「存档 / 持久化」节）

## 资产处理

- raw 生成物与 MANIFEST.jsonl 放在 `game/_generated/`（contract §6/§11）。**导入目标 = `Assets/Resources/Generated/{models,textures,audio}/`**，复制到此并交给 Unity 导入。动态加载用 `Resources.Load(GameConfig.AssetKeys.*)`，**AssetKeys 的值是 Resources 相对路径**（例 `"Generated/models/model-hero"`）。已废止直接放在 `Assets/Generated/` 下的做法
- 带 rig 的角色: 导入 FBX 后，用编辑器脚本设置 `ModelImporter.animationType`（人形为 `Human`，生物等为 `Generic`）并生成 Avatar。动画 FBX 也用同一骨架导入并重定向。**导入（Integrate）的必需验证**: 用编辑器脚本机器确认 `Avatar.isValid`（Humanoid 化成功）与动画剪辑的存在，失败时降级为 `Generic` 并在 MANIFEST 中注记
- 静态道具/环境: 把 GLB 放到 `Assets/Resources/Generated/models/` 交给 glTFast 的 ScriptedImporter 处理
- 音频: Unity 原生支持 Ogg Vorbis / WAV。**仅 OGG 即可**（Safari 用的 M4A 不需要 — phaser 专属要求）
- 必须做尺度验证: Unity 是 1 unit = 1m。导入后检查包围盒，偏离预期尺寸（人形 ≈ 1.6–2.0m）时用 ModelImporter 的 scaleFactor 修正

## QA-PLAY 的执行方法（由 gates.md QA-PLAY 的 unity 节引用）

1. 相当于 build 的命令 exit 0
2. 用 PlayMode 测试验证核心循环 1 周＋**必需场景切换 `Title → Menu → Game → Result → Menu` 的 1 周**，以相当于实际操作的方式（用 `InputTestFixture` 模拟输入发送）。用 `LogAssert.NoUnexpectedReceived()` 机器验证 console 错误为 0
3. 截图证据: 从 PlayMode 测试内保存到 `qa/evidence/`（**不使用 -nographics**）。`ScreenCapture.CaptureScreenshot()` 在 batchmode 下有时不起作用（无后备缓冲）— 此时切换为把相机渲染到 `RenderTexture` 再 `Texture2D.ReadPixels` → `EncodeToPNG` 保存的方式（UI 若为代码规范 14 的 ScreenSpaceCamera Canvas 则会被同一相机拍到。保持 Overlay 的拍摄视为「UI 无法捕获」不合格）。拍摄方式的成败先做机器判定: `magick identify -format "%[fx:mean]" <shot>.png` 低于 0.02/超过 0.98 视为 SUSPECT_BLANK，切换方式重新拍摄。**拍摄的图像必须用 Read 目视，确认对象（模型、UI 文字）确实被拍到**（黑屏、文字缺失为不合格。仅靠值的内部一致性测试无法检测渲染缺陷）
4. acceptance 将 stories.yaml 的各项作为 PlayMode 测试实现并执行
5. **视觉健全性测试（必需、LogAssert 无法检测的缺陷类别）**: 在 PlayMode 测试中放置以下内容 —
   - NaN 坐标检查: `Assert.IsFalse(float.IsNaN(player.position.x) || float.IsNaN(player.position.y) || float.IsNaN(player.position.z))`
   - 相机朝向检查: `Assert.Greater(Vector3.Dot(cam.transform.forward, (target.position - cam.transform.position).normalized), 0.2f)`（是否朝向主要被摄体）
   - 材质缺失检查: 全部 Renderer 的 sharedMaterials 中没有 null / `InternalErrorShader`（粉色）
   - Animator 推进检查（使用 MDL 时）: 当前 state 不是 `__preview__`，且 `GetCurrentAnimatorStateInfo(0).normalizedTime` 在等待 0.2 秒前后有推进（卡死检测）
6. **元进度的持久化测试（必需）**: 按 gates.md QA-PLAY 要点5，用 PlayMode 测试验证 (a) 保存→新实例重新加载→恢复一致，(b) 损坏数据→`.bak` 备份保存＋`[SaveCorruption]` 错误 1 次（用 `LogAssert.Expect(LogType.Error, new Regex("^\\[SaveCorruption\\]"))` 白名单检测）＋默认值恢复。测试的存档位置遵循「存档 / 持久化」节的临时路径规范

## 存档 / 持久化（contract §6 存档规范的 unity 实现权威来源）

- **保存位置**: `Application.persistentDataPath/save.json`。写入采用先写 `.tmp` 再复制/重命名的原子方式（写入中崩溃不会损坏本体）
- **格式**: JSON。首字段 `save_version`（int、必需）。序列化器以 Unity 官方 `JsonUtility` 为第一候选（无追加依赖。不支持 Dictionary，因此 SaveData 用扁平数组+普通类设计）。`System.Text.Json` 在 Unity 运行时的捆绑情况依配置而异，若使用须先在 EditMode 测试中验证序列化往返后再采用
- **层的分离**（contract §11）: 元进度逻辑 = `Assets/Scripts/Systems/Meta/`（pure C#。`MetaTypes.cs`=按版本区分的普通类型 / `MetaSchema.cs`=迁移函数链+验证 / `MetaProgression.cs`=接收 RunResult 并返回新 SaveData 的纯 reducer）。I/O = `Assets/Scripts/Persistence/`（`FileSaveAdapter` 等。`persistentDataPath` 字符串只出现在这里）
- **迁移**: `save_version` 较旧时依次应用 v(n)→v(n+1) 的函数。**比当前版本更新的版本不做转换，按损坏处理**（禁止隐式降级）。迁移函数只增不改
- **损坏时协议（禁止静默初始化 — rules/unity-code.md 强制执行）**: 解析失败、`save_version` 缺失、未来版本、校验和不一致、schema 验证失败（必需字段缺失、类型错误）中的任一情况，均 (1) 将原始数据备份保存到 `save.json.bak.<UTC时间>` → (2) 执行 1 次 `Debug.LogError("[SaveCorruption] reason=... backup=...")` → (3) 以默认值重新生成并把 `recovered: true` 传递到 UI 层（Title/Menu）（toast 等显示可选，但标志的传递必需）
- **保存时机**: 到达 Result 时 `MetaProgression.ApplyRunResult` → 立即 persist 1 次（Result→连续重开不得重复保存。复用内存中的 SaveData）
- **测试规范**: PlayMode 测试为不污染真实用户的存档，使用 `Application.temporaryCachePath` 下的临时文件（每个测试唯一名称），并在 `[TearDown]` 中删除。禁止直接使用 `persistentDataPath` 的测试

## 已知陷阱（不让其跨轮次再发）

> 在 QA fix 中判明为「环境起因的一般规则（引擎/测试运行器的陷阱）」的知识，除记录到 qa/report.md 外还要**立即追加写入**本节（gates.md QA-PLAY。qa-lead → fix 负责 engineer 的责任。不要只埋在 run 产出物中）。

1. **InputSystem 的 batchmode 边界问题（E2/E3 中有再发记录）** — PlayMode 测试中跨越 `[UnitySetUp]` 与 `[UnityTest]` 的边界时，`InputSystem.AddDevice<Mouse>()` 添加的设备的 Press/Release 不会反映到 `InputActionMap.WasPressedThisFrame()`。**场景加载与模拟输入发送放在同一协程内**。实现侧出于同样原因，Title/Menu/HUD 的点击判定要注意输入轮询的初始化时机
2. **正当降级的 `Debug.LogWarning` 与 `LogAssert.NoUnexpectedReceived()` 的冲突（E3 中发现）** — 规范 12 所正当化的「对未导入/未生成资产降级时仅 1 次的 LogWarning」，会让经过该 GameObject/Component 的 PlayMode 测试（例: 加载 Game 场景的 HUD/操作系测试）无条件 false-fail。当资产（例: 图块纹理）实际上已获 AR-ASSET 批准并存在于 `game/_generated/`、只是尚未导入（Integrate）到 `Assets/Resources/Generated/` 时，**批处理验证实施者应优先对该资产做 Integrate，而不是修改测试**（比起给各测试后补 `LogAssert.Expect` 的对症疗法，发挥「已导入则警告本身不会发生」的设计更忠实于实现意图）。仅当导入对象确实未生成（确定以占位符发布）时，才用 `LogAssert.Expect(LogType.Warning, ...)` 允许
3. **PlayMode 测试的 AudioListener 生成采用「仅在不存在时添加」（E3 中发现）** — 用 `SceneManager.LoadScene`（默认 Single）推进到真实场景切换的 PlayMode 测试（例: 验证到胜负确定→切换 Result 的测试）会把切换目标场景自身的 Main Camera+AudioListener 留在测试运行器中。后续测试的 `[SetUp]` 若无条件添加新的 `AudioListener`，会以「There are 2 audio listeners」false-fail；而若无条件销毁残留 Listener，则不自带 Listener 的设计的测试（隐式依赖「正式场景总有 1 个 Listener」的前提）会以「There are no audio listeners」false-fail（在一次性 `AudioSource`（`PlayClipAtPoint` 等）的自销毁计时器尚未到期时发生）。**仅在 `Object.FindAnyObjectByType<AudioListener>() == null` 时自行添加，TearDown 中只销毁自己添加的那份（用 bool 字段记录所有权）**是同时避开两种警告的唯一方式
4. **-batchmode 的 PlayMode 无 vsync、运行极快（E3 Polish 批处理验证中发现）** — `-batchmode -runTests -testPlatform PlayMode` 的实际帧不伴随画面绘制，本环境实测平均 `Time.deltaTime ≈ 0.00013秒/帧`（约相当于 7500fps），比 60fps 前提的直觉快 2 个数量级以上。「仅用 `for (int i = 0; i < N; i++) { yield return null; ... }` 的**帧数上限**等待 `Time.deltaTime` 驱动的演出（后坐、击破缩小、受击闪烁等）在持续时间过后回到默认状态的测试」，在 `N=300` 左右时实时间换算只经过约 0.04 秒，达不到 `0.15～0.2s` 级的演出时长而 false-fail。**依赖 frame-timing 的「等待复位」循环的帧预算，要设为相对目标 duration 有 2 个数量级以上余量的值（例: 20000）**，或以基于 `Time.time`/`Time.realtimeSinceStartup` 的经过时间为主条件、帧数仅作为安全阀（防止无限循环）
5. **建造点的点击判定「不按占用与否分开扫描」（E3 Polish 批处理验证中发现）** — `GameConfig.Build.SpotPositions` 在同一列（同一 X）隔着路径放置 2 个点（Z=+3m/-3m），但在固定俯视相机构图下同一列 2 个点的屏幕距离可能与 `GameConfig.Ui.BuildSpotClickPickRadiusPx`（70px）相当或更小（实测约 53～58px）。若像「先全扫描空点 → 找不到再全扫描占用点」那样分两段做命中测试，本想点击一侧的点，却因 pick 半径重叠误检出相邻的另一侧点。**要做成先求出距点击位置最近的唯一一个点（不问占用与否），再按该点的占用状态分支的一体化命中测试**（参见 Ui/HudPanel.FindClickedSpot）

## 面向未来引擎无关化的边界划分

- `Assets/Scripts/Systems/` 不 import UnityEngine 的场景 API、MonoBehaviour、File I/O（仅值类型、数学类型允许）— 这里是引擎无关层（`Systems/Meta/` 同样）
- Unity 依赖封闭在 `Components/` `Ui/` `Input/` `Scenes/` `Persistence/` 中
