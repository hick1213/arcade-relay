#!/bin/bash
# ArcadeRelay hook: SessionStart
# 根据当前 stage（state/stage.txt）与 pipeline.yaml，用数行显示「当前位置与下一步操作」。
# advisory hook: 任何情况下都 exit 0。不需要依赖工具（仅 grep/sed/awk。兼容 macOS bash 3.2）。

# --- 解析项目根目录（优先 CLAUDE_PROJECT_DIR，没有则从脚本位置反推） ---
ROOT="${CLAUDE_PROJECT_DIR:-}"
if [ -z "$ROOT" ]; then
  ROOT="$(cd "$(dirname "$0")/../.." 2>/dev/null && pwd)"
fi
[ -z "$ROOT" ] && exit 0

STAGE_FILE="$ROOT/state/stage.txt"
PIPELINE="$ROOT/.claude/docs/pipeline.yaml"
ACTIVE="$ROOT/state/active.md"

# --- stage 未设置则仅给出未开始指引 ---
if [ ! -f "$STAGE_FILE" ]; then
  echo "[ArcadeRelay] 未开始。请用 /forge 开始。"
  exit 0
fi

STAGE="$(head -1 "$STAGE_FILE" 2>/dev/null | tr -d '[:space:]')"
if [ -z "$STAGE" ]; then
  echo "[ArcadeRelay] state/stage.txt 为空。请用 /forge-status 确认，或用 /forge 开始。"
  exit 0
fi

# --- 从 pipeline.yaml 提取指定 stage 块的辅助函数（不需要 yq 的 awk 提取） ---
extract_block() { # $1 = stage 名。块正文输出到标准输出（找不到则为空）
  awk -v s="$1" '
    /^[[:space:]]*-[[:space:]]*stage:[[:space:]]*/ {
      cur=$0; sub(/^[[:space:]]*-[[:space:]]*stage:[[:space:]]*/,"",cur); sub(/[[:space:]#].*$/,"",cur);
      inblk = (cur==s); next
    }
    inblk { print }
  ' "$PIPELINE"
}
field() { # $1 = 块正文, $2 = 字段名
  echo "$1" | grep -m1 "^[[:space:]]*$2:" | sed -e "s/^[[:space:]]*$2:[[:space:]]*//" -e 's/[[:space:]]*#.*$//' -e 's/^"//' -e 's/"[[:space:]]*$//'
}

# --- pipeline.yaml 缺失时与 stage 未定义区分开来给出指引 ---
if [ ! -f "$PIPELINE" ]; then
  echo "[ArcadeRelay] stage: $STAGE"
  echo "[ArcadeRelay] 找不到 pipeline.yaml（.claude/docs/pipeline.yaml）。harness 已损坏。请用 /forge-status 确认。"
  exit 0
fi

BLOCK="$(extract_block "$STAGE")"
if [ -z "$BLOCK" ]; then
  echo "[ArcadeRelay] stage: $STAGE"
  echo "[ArcadeRelay] 在 pipeline.yaml 中找不到 stage '$STAGE' 的定义。state/stage.txt 可能不正确。请用 /forge-status 确认。"
  exit 0
fi

TITLE="$(field "$BLOCK" title)"
NEXT="$(field "$BLOCK" next)"

# --- 当前位置与下一步操作（stage 值=该阶段已完成。下一步操作是 next stage 的 command） ---
echo "[ArcadeRelay] stage: $STAGE${TITLE:+ — $TITLE}（此阶段已完成）"
if [ "$STAGE" = "done" ] || [ "$NEXT" = "null" ] || [ -z "$NEXT" ]; then
  echo "[ArcadeRelay] 流水线已完成。产出物见 game/（启动方法按引擎区分 — 用 /forge-status 确认）。"
else
  NEXT_BLOCK="$(extract_block "$NEXT")"
  NEXT_COMMAND="$(field "$NEXT_BLOCK" command)"
  if [ -n "$NEXT_COMMAND" ] && [ "$NEXT_COMMAND" != "null" ]; then
    echo "[ArcadeRelay] 下一步操作: 执行 ${NEXT_COMMAND}（next stage: ${NEXT}）"
  elif [ -z "$NEXT_BLOCK" ]; then
    echo "[ArcadeRelay] 在 pipeline.yaml 中找不到 next stage '${NEXT}' 的定义。请用 /forge-status 确认。"
  else
    # next stage 没有 command（= next: done）。只剩交付
    echo "[ArcadeRelay] 下一步操作: 用 /forge 进行最终报告与交付（next stage: ${NEXT}）"
  fi
fi

# --- state/active.md 的开头预览 ---
if [ -f "$ACTIVE" ]; then
  echo ""
  echo "--- state/active.md（前 20 行） ---"
  head -20 "$ACTIVE" 2>/dev/null
  echo "-----------------------------------"
fi

exit 0
