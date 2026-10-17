#!/usr/bin/env bash
# hook テスト用の最小アサート関数。各 *.test.sh から source して使う。

FAILS=0

# run_hook <script_path> <json> → OUT / ERR / CODE を設定する
run_hook() {
  local errfile
  errfile=$(mktemp)
  OUT=$(printf '%s' "$2" | bash "$1" 2>"$errfile")
  CODE=$?
  ERR=$(cat "$errfile")
  rm -f "$errfile"
}

# assert_eq <name> <expected> <actual>
assert_eq() {
  if [[ "$2" != "$3" ]]; then
    echo "FAIL: $1"
    echo "  expected: $2"
    echo "  actual:   $3"
    FAILS=$((FAILS + 1))
  fi
}

finish() {
  if ((FAILS == 0)); then
    echo "ok"
    exit 0
  fi
  echo "$FAILS failure(s)"
  exit 1
}

# JSON 入力を組み立てるヘルパー（jq で正しくエスケープする）
edit() { jq -cn --arg t "$1" --arg p "$2" '{tool_name: $t, tool_input: {file_path: $p}}'; }
bash_cmd() { jq -cn --arg c "$1" '{tool_name: "Bash", tool_input: {command: $c}}'; }
stop() { jq -cn --argjson a "$1" '{stop_hook_active: $a}'; }
