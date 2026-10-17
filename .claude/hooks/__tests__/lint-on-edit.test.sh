#!/usr/bin/env bash
# lint-on-edit.sh のテスト（実 repo 上で一時ファイルを使い、終了時に必ず消す）

cd "$(dirname "$0")" || exit 1
source ./lib.sh
H="$(cd .. && pwd)/lint-on-edit.sh"
ROOT="$(cd ../../.. && pwd)"
export CLAUDE_PROJECT_DIR="$ROOT"

F="$ROOT/packages/domain/src/__hooktest__.ts"
W="$ROOT/apps/web/src/app/__hooktest__.tsx"
trap 'rm -f "$F" "$W"' EXIT

printf "import { z } from 'zod';\nexport const a = z;\n" >"$F"
run_hook "$H" "$(edit Edit "$F")"
assert_eq violation_exit2 2 "$CODE"
assert_eq violation_message 1 "$(grep -c no-restricted-imports <<<"$ERR")"

printf "export const a = 1\n" >"$F"
run_hook "$H" "$(edit Write "$F")"
assert_eq clean_exit0 0 "$CODE"
assert_eq prettier_applied "export const a = 1;" "$(cat "$F")"

printf "import { createClient } from '@supabase/supabase-js';\nexport const c = createClient;\n" >"$W"
run_hook "$H" "$(edit Write "$W")"
assert_eq app_violation_exit2 2 "$CODE"

rm -f "$F"
run_hook "$H" "$(edit Edit "$F")"
assert_eq missing_file_noop 0 "$CODE"
run_hook "$H" "$(edit Edit "$ROOT/apps/web/.next/x.ts")"
assert_eq ignored_file_noop 0 "$CODE"
run_hook "$H" "$(edit Edit "$ROOT/docs/specs/README.md")"
assert_eq non_ts_noop 0 "$CODE"
run_hook "$H" "$(edit Edit /tmp/outside.ts)"
assert_eq outside_repo_noop 0 "$CODE"

finish
