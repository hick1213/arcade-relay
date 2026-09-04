---
paths: ["game/Assets/**/*.cs"]
---

# unity-code — 编辑 game/Assets 的 C# 时的强制规范（engine=unity）

权威来源: `.codex/docs/tech-stack-unity.md`。违反会在 CR-CODE Gate 中得到 CONCERNS 以上的判定。
思想与 phaser 版 `gameplay-code.md` 相同（禁止魔法数字 / delta-time / 引擎无关核心 / 输入抽象化 / 资产键集中），翻译为 Unity 惯用法。

## Do / Don't

- **Do**: 游戏参数（速度、重力、HP、分数、时间、颜色、尺寸）集中到 `Assets/Scripts/GameConfig.cs` 的静态常量类。调优必须仅通过编辑 GameConfig.cs 即可完成
- **Don't**: 不要在 MonoBehaviour 或 System 的正文中直接写数值字面量（数组 index、`0`/`1` 初始值等无语义的值除外）
- **Do**: 移动、计时器、冷却在 `Update()` 内以 `Time.deltaTime`、物理在 `FixedUpdate()` 内以 `Time.fixedDeltaTime` 进行缩放
- **Don't**: 不要写每帧固定加算（`x += 5f`）。禁止以 60fps 为前提的实现
- **Don't**: 不要在 `Assets/Scripts/Systems/` 中继承 `MonoBehaviour`、调用场景 API（`GameObject.Find` / `Instantiate` / `GetComponent`）。Systems 是引擎无关层（纯 C# 类。`Vector3`/`Mathf` 等值类型、数学类型可用）。MonoBehaviour 依赖封闭在 `Assets/Scripts/Components/`（场景接线层）中
- **Do**: Components 层只负责生命周期与接线（System 的创建、输入的传递、向 Transform 的反映）。判定、状态迁移、分数计算的逻辑放到 `Systems/` 的纯类中
- **Do**: 输入使用 Input System（`com.unity.inputsystem`），集中到 `Assets/Scripts/Input/` 的唯一模块
- **Don't**: 不要使用旧 `Input.GetKey` / `Input.GetAxis`。不要在每个 MonoBehaviour 中分散输入读取
- **Don't**: 在 PlayMode 测试中，不要跨越 `[UnitySetUp]` 与 `[UnityTest]` 的边界把输入设备添加与模拟发送分开 — 场景加载与模拟输入发送收在同一协程内。Title/Menu/HUD 的点击判定要注意输入轮询的初始化时机（权威来源: tech-stack-unity.md「已知陷阱」）
- **Do**: 资产引用（预制体、材质、AudioClip 等的动态加载）经由 `GameConfig.cs` 的 `AssetKeys` 常量。Inspector 直接引用（`[SerializeField]`）可用
- **Don't**: 禁止 `Resources.Load("Hero")` 这类路径字符串直写
- **Do**: 持久化 I/O（`Application.persistentDataPath`、`File`、`PlayerPrefs`）仅在 `Assets/Scripts/Persistence/` 中进行。元进度逻辑放在 `Systems/Meta/` 的 pure C#（接收值并返回值的 reducer）中（tech-stack-unity.md「存档 / 持久化」）
- **Don't**: 不要从 `Systems/`、`Components/`、`Ui/` 直接调用 File I/O / PlayerPrefs
- **Don't**: **存档损坏时不得静默初始化** — 解析失败、`save_version` 缺失、未来版本、schema 验证失败（必需字段缺失、类型不正确）必须执行三件套: (1) 备份保存到 `.bak` (2) `Debug.LogError("[SaveCorruption] ...")` 1次 (3) 以默认值重新生成＋传播 `recovered` 标志（contract §6）。仅 catch 后返回默认值的实现、按字段填入默认值的实现在 CR-CODE 中为 CONCERNS 以上
- **Don't**: 不要把 HUD/菜单的 Canvas 设为 `RenderMode.ScreenSpaceOverlay`（不会出现在 QA 的 RenderTexture 拍摄中 — tech-stack-unity.md 规范14。固定为 `ScreenSpaceCamera` + `worldCamera`）

## 正误示例

### 魔法数字

```csharp
// NG: 组件中直写数值
transform.position += Vector3.forward * 5f * Time.deltaTime;
if (score > 1000) LevelUp();

// OK: 集中到 GameConfig.cs
public static class GameConfig
{
    public static class Player { public const float MoveSpeed = 5f; }        // m/s
    public static class Score  { public const int LevelUpThreshold = 1000; }
}

// 使用侧
transform.position += Vector3.forward * GameConfig.Player.MoveSpeed * Time.deltaTime;
if (score > GameConfig.Score.LevelUpThreshold) LevelUp();
```

### Systems/ 的引擎无关

```csharp
// NG: Assets/Scripts/Systems/CombatSystem.cs
public class CombatSystem : MonoBehaviour            // 禁止（在 Systems 中继承 MonoBehaviour）
{
    void Update() { /* ... */ }
}

// OK: Assets/Scripts/Systems/CombatSystem.cs — 纯 C#。接收状态并返回新状态
public static class CombatSystem
{
    public static EntityState ApplyHit(EntityState target, int damage) =>
        target with { Hp = System.Math.Max(0, target.Hp - damage) };
}
```

### 输入集中（Input System）

```csharp
// NG: 分散在各 MonoBehaviour 中
if (Input.GetKeyDown(KeyCode.Space)) Jump();          // 旧API与分散的双重违反

// OK: 集中到 Assets/Scripts/Input/InputReader.cs，Components 订阅事件/状态
public sealed class InputReader
{
    private readonly GameInputActions actions = new();  // Input System 生成的类
    public bool JumpPressed => actions.Gameplay.Jump.WasPressedThisFrame();
}
```
