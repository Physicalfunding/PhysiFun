#!/usr/bin/env bash
# cloud-scope-guard.sh のテスト（書き込みの判定）

cd "$(dirname "$0")" || exit 1
source ./lib.sh
G="$(cd .. && pwd)/cloud-scope-guard.sh"
deny='"permissionDecision":"deny"'
denied() { grep -c "$deny" <<<"$OUT"; }

export CLAUDE_CODE_REMOTE=true
export CLAUDE_PROJECT_DIR=/repo
export CLOUD_ALLOWLIST="$(cd ../.. && pwd)/cloud-allowlist"

run_hook "$G" "$(edit Edit /repo/docs/specs/README.md)"
assert_eq green_docs "" "$OUT"
run_hook "$G" "$(edit Write /repo/apps/web/src/components/Button.tsx)"
assert_eq green_component "" "$OUT"
run_hook "$G" "$(edit Edit /repo/packages/domain/src/project/__tests__/a.test.ts)"
assert_eq green_test "" "$OUT"
run_hook "$G" "$(edit Edit /repo/packages/infrastructure/atlas/schema.sql)"
assert_eq red_atlas 1 "$(denied)"
run_hook "$G" "$(edit Edit /repo/packages/application/src/project/CreateProjectDraftUseCase.ts)"
assert_eq yellow_usecase 1 "$(denied)"
run_hook "$G" "$(edit Edit /repo/CLAUDE.md)"
assert_eq claude_md_denied 1 "$(denied)"
run_hook "$G" "$(edit Edit /repo/.claude/skills/dev/SKILL.md)"
assert_eq dotclaude_md_denied 1 "$(denied)"
run_hook "$G" "$(edit Write /repo/.claude/cloud-allowlist)"
assert_eq allowlist_denied 1 "$(denied)"
run_hook "$G" "$(edit Edit /tmp/scratch.txt)"
assert_eq outside_repo_allowed "" "$OUT"
run_hook "$G" "$(edit Edit /repo/docs/../packages/domain/src/a.ts)"
assert_eq dotdot_denied 1 "$(denied)"
run_hook "$G" "$(edit Edit /repo/packages/infrastructure/atlas/schema.sql)"
assert_eq deny_reason_names_path 1 "$(grep -c 'packages/infrastructure/atlas/schema.sql を編集できません' <<<"$OUT")"
CLAUDE_CODE_REMOTE='' run_hook "$G" "$(edit Edit /repo/packages/infrastructure/atlas/schema.sql)"
assert_eq local_noop "" "$OUT"

finish
