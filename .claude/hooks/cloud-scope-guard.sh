#!/usr/bin/env bash
# PreToolUse hook: クラウドセッションで、許可リスト（🟢・🟡）以外への書き込みを拒否する
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

# bypasses_git_hooks <1 つのコマンドの単語列>: git hook を飛ばす git コマンドなら 0
bypasses_git_hooks() {
  while [[ "${1:-}" == *=* && "$1" != -* ]]; do shift; done # 先頭の環境変数の代入
  [[ "${1:-}" == "git" ]] || return 1
  shift
  local sub="" tok prev="" lower
  while (($# > 0)); do
    lower=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')
    if [[ -z "$sub" ]]; then
      case "$1" in
        -c) [[ "$(printf '%s' "${2:-}" | tr '[:upper:]' '[:lower:]')" == core.hookspath=* ]] && return 0
          shift 2 && continue ;;
        -C) shift 2 && continue ;;
        -*) shift && continue ;;
        *) sub="$1" && shift && continue ;;
      esac
    fi
    [[ "$1" == "--no-verify" ]] && return 0
    [[ "$sub" == "commit" && "$1" =~ ^-[a-zA-Z]*n[a-zA-Z]*$ ]] && return 0
    if [[ "$sub" == "config" ]]; then
      [[ "$lower" == --unset* || "$lower" == --replace-all || "$lower" == --add ]] && tok="mod"
      if [[ "$prev" == "core.hookspath" && "$1" != -* ]]; then return 0; fi
      [[ "$lower" == "core.hookspath" && "$tok" == "mod" ]] && return 0
    fi
    prev="$lower"
    shift
  done
  return 1
}

TOOL=$(jq -r '.tool_name // empty' <<<"$INPUT")

case "$TOOL" in
  Edit | Write | NotebookEdit)
    FILE=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' <<<"$INPUT")
    [[ -z "$FILE" ]] && exit 0
    # 正規化されていないパス（..・.・//）は「常に拒否」の行に当たらず、許可リストの最後の * で許可されてしまうので拒否する
    if [[ "$FILE" == *"/../"* || "$FILE" == ../* || "$FILE" == *"/.." ||
      "$FILE" == *"/./"* || "$FILE" == ./* || "$FILE" == *"/." || "$FILE" == *"//"* ]]; then
      deny "クラウドセッションでは '..'・'.'・'//' を含むパス（$FILE）を編集できません。正規化したパスで指定してください。"
    fi
    if [[ "$FILE" == /* ]]; then
      [[ "$FILE" == "$PROJECT_DIR/"* ]] || exit 0 # repo 外は PR に入らないので許可
      REL="${FILE#"$PROJECT_DIR"/}"
    else
      REL="$FILE"
    fi
    is_allowed "$REL" ||
      deny "クラウドセッションでは $REL を編集できません（docs/guides/ai-harness.md 4 章）。cloud-plan skill で計画書を docs-repository の plans/ に書き、PR にしてください。"
    ;;
  Bash)
    # commit・push の中身は .claude/git-hooks（pre-commit / pre-push）が判定する。
    # ここでは git hook を飛ばす操作だけを止める。引用符の中（コミットメッセージや PR 本文）は見ない。
    CMD=$(jq -r '.tool_input.command // empty' <<<"$INPUT")
    STRIPPED=$(printf '%s' "$CMD" | sed -E "s/'[^']*'/Q/g; s/\"([^\"\\\\]|\\\\.)*\"/Q/g" | tr '\n' ';' |
      sed -E 's/(&&|\|\||\|)/;/g')
    IFS=';' read -r -a SEGMENTS <<<"$STRIPPED"
    set -f # 単語に分けるときにワイルドカードを展開しない
    for seg in "${SEGMENTS[@]}"; do
      bypasses_git_hooks $seg &&
        deny "クラウドセッションでは git hook を飛ばす操作（--no-verify、commit -n、core.hooksPath の変更）はできません（docs/guides/ai-harness.md 4 章）。"
    done
    ;;
esac

exit 0
