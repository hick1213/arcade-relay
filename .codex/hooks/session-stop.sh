#!/bin/bash
# ArcadeRelay hook: Stop
# 仅在 state/ 存在时，向 state/session-log.txt 追加写入 1 行会话结束记录。
# advisory hook: 任何情况下都 exit 0。标准输出不输出任何内容。

ROOT="${CODEX_PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-}}"
if [ -z "$ROOT" ]; then
  ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
fi
if [ -z "$ROOT" ]; then
  ROOT="$(cd "$(dirname "$0")/../.." 2>/dev/null && pwd)"
fi
[ -z "$ROOT" ] && exit 0
[ -d "$ROOT/state" ] || exit 0

STAGE="none"
if [ -f "$ROOT/state/stage.txt" ]; then
  S="$(head -1 "$ROOT/state/stage.txt" 2>/dev/null | tr -d '[:space:]')"
  [ -n "$S" ] && STAGE="$S"
fi

echo "session end: $(date -u +%Y-%m-%dT%H:%M:%SZ) stage=$STAGE" >> "$ROOT/state/session-log.txt" 2>/dev/null

exit 0
