#!/usr/bin/env bash
# PreToolUse hook: クラウドセッションで、許可リスト（緑）以外への書き込みを拒否する
# ローカル（CLAUDE_CODE_REMOTE != true）では何もしない。
# うっかりを防ぐガードであり、悪意ある回避を防ぐセキュリティ境界ではない。
# commit・push の中身の判定は .claude/git-hooks が行う（PreToolUse はコマンド実行前に走るため、1 コマンドにまとめた書き込み＋commit を見られない）。
# 参照: docs/guides/ai-harness.md 4 章・P1

[[ "${CLAUDE_CODE_REMOTE:-}" == "true" ]] || exit 0

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
ALLOWLIST="${CLOUD_ALLOWLIST:-$PROJECT_DIR/.claude/cloud-allowlist}"
INPUT=$(cat)

# shellcheck source=lib/allowlist.sh
source "$(dirname "$0")/lib/allowlist.sh"

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
  Bash)
    # commit・push の中身は .claude/git-hooks（pre-commit / pre-push）が判定する。
    # ここでは git hook を飛ばす操作だけを止める。
    CMD=$(jq -r '.tool_input.command // empty' <<<"$INPUT")
    if [[ "$CMD" == *"--no-verify"* || "$CMD" == *"hooksPath"* ]] ||
      [[ "$CMD" =~ git[[:space:]]+commit([[:space:]]+[^[:space:]]+)*[[:space:]]+-[a-zA-Z]*n[a-zA-Z]*([[:space:]]|$) ]]; then
      deny "クラウドセッションでは git hook を飛ばす操作（--no-verify、commit -n、core.hooksPath の変更）はできません（docs/guides/ai-harness.md 4 章）。"
    fi
    ;;
esac

exit 0
