#!/usr/bin/env bash
# verify-on-stop.sh のテスト（一時的な git repo で、検証コマンドを VERIFY_CMD で差し替える）

cd "$(dirname "$0")" || exit 1
source ./lib.sh
V="$(cd .. && pwd)/verify-on-stop.sh"
blk='"decision":"block"'
blocked() { grep -c "$blk" <<<"$OUT"; }

T=$(mktemp -d)
git init -q -b main "$T/work"
cd "$T/work" || exit 1
git config user.email t@example.com && git config user.name t
echo a >README.md && git add -A && git commit -qm init
export CLAUDE_PROJECT_DIR="$T/work"

run_hook "$V" "$(stop false)"
assert_eq no_changes_noop "" "$OUT"

mkdir -p docs && echo x >docs/note.md
VERIFY_CMD=false run_hook "$V" "$(stop false)"
assert_eq docs_only_noop "" "$OUT"

echo x >a.ts
VERIFY_CMD=false run_hook "$V" "$(stop false)"
assert_eq fail_blocks 1 "$(blocked)"
assert_eq block_is_valid_json block "$(jq -r .decision <<<"$OUT")"
assert_eq first_block_count 1 "$(grep -c '1/3' <<<"$OUT")"

VERIFY_CMD=false run_hook "$V" "$(stop true)"
assert_eq second_block 1 "$(grep -c '2/3' <<<"$OUT")"
VERIFY_CMD=false run_hook "$V" "$(stop true)"
assert_eq last_block_warns 1 "$(grep -c '最後の差し戻し' <<<"$OUT")"
VERIFY_CMD=false run_hook "$V" "$(stop true)"
assert_eq fourth_allows "" "$OUT"

VERIFY_CMD=true run_hook "$V" "$(stop false)"
assert_eq pass_allows "" "$OUT"
VERIFY_CMD=false run_hook "$V" "$(stop false)"
assert_eq same_hash_skips "" "$OUT"

echo y >>a.ts
VERIFY_CMD=false run_hook "$V" "$(stop false)"
assert_eq changed_after_pass_runs 1 "$(blocked)"
assert_eq counter_reset_after_allow 1 "$(grep -c '1/3' <<<"$OUT")"

VERIFY_CMD='echo "boom: test failed"; false' run_hook "$V" "$(stop false)"
assert_eq reason_includes_output 1 "$(jq -r .reason <<<"$OUT" | grep -c '^boom: test failed$')"

N=$(mktemp -d)
CLAUDE_PROJECT_DIR="$N" VERIFY_CMD=false run_hook "$V" "$(stop false)"
assert_eq not_git_repo_noop "" "$OUT"

cd / && rm -rf "$T" "$N"
finish
