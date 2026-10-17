#!/usr/bin/env bash
# クラウドの許可リスト（.claude/cloud-allowlist）の判定。
# cloud-scope-guard.sh（PreToolUse）と .claude/git-hooks（pre-commit / pre-push）から source する。
# 呼び出し側で ALLOWLIST に許可リストのパスを入れておくこと。

# is_allowed <repo ルートからの相対パス>
# 常に拒否（! 行）に当たれば 1、緑に当たれば 0、どれでもなければ 1
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

# blocked_files: stdin のファイル一覧（1 行 1 パス）のうち、許可されないものを 1 行ずつ出す
blocked_files() {
  local f
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    is_allowed "$f" || echo "$f"
  done
}
