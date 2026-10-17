#!/usr/bin/env bash
# PreToolUse hook: クラウドセッションで、許可リスト（緑）以外への書き込みを拒否する
# ローカル（CLAUDE_CODE_REMOTE != true）では何もしない。
# うっかりを防ぐガードであり、悪意ある回避を防ぐセキュリティ境界ではない。
# 参照: docs/guides/ai-harness.md 4 章・P1

[[ "${CLAUDE_CODE_REMOTE:-}" == "true" ]] || exit 0

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
ALLOWLIST="${CLOUD_ALLOWLIST:-$PROJECT_DIR/.claude/cloud-allowlist}"
INPUT=$(cat)

# 常に拒否に当たれば 1、緑に当たれば 0、どれでもなければ 1
is_allowed() {
  local rel="$1" line allowed=1
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    if [[ "$line" == !* ]]; then
      # shellcheck disable=SC2053
      [[ "$rel" == ${line#!} ]] && return 1
    else
      # shellcheck disable=SC2053
      [[ "$rel" == $line ]] && allowed=0
    fi
  done <"$ALLOWLIST"
  return $allowed
}

deny() {
  jq -cn --arg r "$1" \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $r}}'
  exit 0
}

TOOL=$(jq -r '.tool_name // empty' <<<"$INPUT")

case "$TOOL" in
  Edit | Write | NotebookEdit)
    FILE=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' <<<"$INPUT")
    [[ -z "$FILE" ]] && exit 0
    if [[ "$FILE" == *"/../"* || "$FILE" == ../* || "$FILE" == *"/.." ]]; then
      deny "クラウドセッションでは '..' を含むパス（$FILE）を編集できません。正規化したパスで指定してください。"
    fi
    if [[ "$FILE" == /* ]]; then
      [[ "$FILE" == "$PROJECT_DIR/"* ]] || exit 0 # repo 外は PR に入らないので許可
      REL="${FILE#"$PROJECT_DIR"/}"
    else
      REL="$FILE"
    fi
    is_allowed "$REL" ||
      deny "クラウドセッションでは $REL を編集できません（docs/guides/ai-harness.md 4 章）。plan skill で計画書を docs-repository の plans/ に書き、PR にしてください。"
    ;;
esac

exit 0
