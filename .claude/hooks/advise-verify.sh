#!/bin/bash
# ArcadeRelay hook: PostToolUse (Write|Edit)
# 从 stdin 的 JSON 事件中提取 file_path，若是 game/ 下的代码变更，
# 则输出一句提示以督促执行按引擎区分的验证（phaser: .ts / unity: .cs / unreal: .cpp/.h）。其他情况保持沉默。
# advisory hook: 任何情况下都 exit 0。有 jq 则使用，没有则回退到 grep/sed。

INPUT="$(cat 2>/dev/null)"
[ -z "$INPUT" ] && exit 0

FILE_PATH=""
if command -v jq >/dev/null 2>&1; then
  FILE_PATH="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)"
fi
if [ -z "$FILE_PATH" ]; then
  # 回退: 朴素地取出第一个 "file_path":"..."（假定为无转义的普通路径）
  FILE_PATH="$(printf '%s' "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed -e 's/^"file_path"[[:space:]]*:[[:space:]]*"//' -e 's/"$//')"
fi
[ -z "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  */game/src/*.ts|game/src/*.ts)
    echo "[ArcadeRelay] 修改了 game/src/ 的 TypeScript。修改后请执行 cd game && npm run typecheck 并确认 exit 0。"
    ;;
  */game/Assets/*.cs|game/Assets/*.cs)
    echo "[ArcadeRelay] 修改了 game/Assets/ 的 C#。修改后请用 .claude/docs/tech-stack-unity.md 的「验证命令」（batchmode 编译验证）确认 exit 0。"
    ;;
  */game/Source/*.cpp|game/Source/*.cpp|*/game/Source/*.h|game/Source/*.h)
    echo "[ArcadeRelay] 修改了 game/Source/ 的 C++。修改后请用 .claude/docs/tech-stack-unreal.md 的「验证命令」（UnrealBuildTool 构建）确认 exit 0。"
    ;;
esac

exit 0
