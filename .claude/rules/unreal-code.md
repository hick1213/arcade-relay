---
paths: ["game/Source/**"]
---

# unreal-code — 编辑 game/Source 的 C++ 时的强制规范（engine=unreal）

权威来源: `.claude/docs/tech-stack-unreal.md`。违反会在 CR-CODE Gate 中得到 CONCERNS 以上的判定。
思想与 phaser 版 `gameplay-code.md` 相同（禁止魔法数字 / delta-time / 引擎无关核心 / 输入抽象化 / 资产键集中），翻译为 UE C++ 惯用法。

## Do / Don't

- **Do**: 游戏参数（速度、HP、分数、时间）集中到 `Source/ForgeGame/GameConfig.h` 的 `namespace GameConfig` 内的 `constexpr` 常量。调优必须仅通过编辑 GameConfig.h 即可完成
- **Don't**: 不要在 Actor / Component 的正文中直接写数值字面量（数组 index、`0`/`1` 初始值等无语义的值除外）
- **Do**: 移动、计时器以 `Tick(float DeltaSeconds)` 的 `DeltaSeconds` 进行缩放（物理交给相当于 FixedTick 的物理子步）
- **Don't**: 不要写每帧固定加算。禁止以固定帧率为前提的实现
- **Don't**: 不要在 `Source/ForgeGame/Systems/` 中继承 `UObject` / `AActor`、调用 `UWorld` / `SpawnActor` / `FindObject`。Systems 是引擎无关层（纯 C++。`FVector`/`FMath` 等核心值类型、数学类型可用）。UObject 依赖封闭在 `Source/ForgeGame/Actors/`（场景接线层）中
- **Do**: Actors 层只负责生命周期与接线。判定、状态迁移、分数计算的逻辑放到 `Systems/` 的纯函数/类中
- **Do**: 输入使用 Enhanced Input（`UInputAction` / `UInputMappingContext`），映射集中到1处（PlayerController 或专用组件）
- **Don't**: 不要使用旧 `BindAxis("MoveForward")` 系的基于字符串的输入。不要在每个 Actor 中分散输入绑定
- **Do**: 资产引用使用集中到 `GameConfig.h` 的 `FSoftObjectPath` / `TSoftObjectPtr` 常量，或经由 UPROPERTY 的直接引用。路径字符串仅存在于常量的1处
- **Don't**: 不要在实现正文中直写 `LoadObject<UStaticMesh>(nullptr, TEXT("/Game/Meshes/Hero"))` 这类路径字符串
- **Do**: 持久化 I/O（`USaveGame` 派生、`UGameplayStatics::SaveGameToSlot/LoadGameFromSlot`）仅在 `Source/ForgeGame/Persistence/` 中进行。元进度逻辑放在 `Systems/Meta/` 的 pure C++（纯 struct + 纯函数）中（tech-stack-unreal.md「存档 / 持久化」）
- **Don't**: 不要把 `USaveGame` 放在 `Systems/` 中（因为是 UObject 派生，违反规范）。不要从 `Actors/`、`Ui/` 直接调用 SaveGameToSlot
- **Don't**: **存档损坏时不得静默初始化** — 加载失败、`SaveVersion` 不正确、schema 验证失败（必需字段缺失、类型不正确）必须执行三件套: (1) 备份保存到 `.bak.sav` (2) `UE_LOG(LogForgeGame, Error, TEXT("[SaveCorruption] ..."))` 1次 (3) 以默认值重新生成＋传播 `bRecovered`（contract §6）。静默吞掉失败仅返回默认值的实现、按字段填入默认值的实现在 CR-CODE 中为 CONCERNS 以上

## 正误示例

### 魔法数字

```cpp
// NG: Actor 中直写数值
AddActorWorldOffset(GetActorForwardVector() * 600.f * DeltaSeconds);
if (Score > 1000) { LevelUp(); }

// OK: 集中到 Source/ForgeGame/GameConfig.h
namespace GameConfig
{
    namespace Player { constexpr float MoveSpeed = 600.f; }   // cm/s（UE单位）
    namespace Score  { constexpr int32 LevelUpThreshold = 1000; }
}

// 使用侧
AddActorWorldOffset(GetActorForwardVector() * GameConfig::Player::MoveSpeed * DeltaSeconds);
if (Score > GameConfig::Score::LevelUpThreshold) { LevelUp(); }
```

### Systems/ 的引擎无关

```cpp
// NG: Source/ForgeGame/Systems/CombatSystem.h
#include "GameFramework/Actor.h"                     // 禁止（在 Systems 中依赖 UObject/Actor）
class ACombatSystem : public AActor { /* ... */ };

// OK: Source/ForgeGame/Systems/CombatSystem.h — 纯 C++
#include "ForgeGame/Types.h"
namespace CombatSystem
{
    FEntityState ApplyHit(const FEntityState& Target, int32 Damage);  // 接收值并返回值
}
```

### 输入集中（Enhanced Input）

```cpp
// NG: 基于字符串的旧输入、分散在各 Actor 中
InputComponent->BindAxis("MoveForward", this, &AHero::MoveForward);

// OK: Enhanced Input。以属性接收 UInputAction，在 PlayerController 的1处做映射
UPROPERTY(EditDefaultsOnly, Category="Input") TObjectPtr<UInputAction> MoveAction;
EnhancedInput->BindAction(MoveAction, ETriggerEvent::Triggered, this, &AHero::OnMove);
```
