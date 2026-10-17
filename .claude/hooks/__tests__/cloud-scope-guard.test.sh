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

# --- Bash: git hook を飛ばす操作を拒否する（commit・push の中身は .claude/git-hooks が判定する） ---
run_hook "$G" "$(bash_cmd 'git commit --no-verify -m x')"
assert_eq commit_no_verify_denied 1 "$(denied)"
run_hook "$G" "$(bash_cmd 'git add -A && git commit -nm x')"
assert_eq commit_n_denied 1 "$(denied)"
run_hook "$G" "$(bash_cmd 'git push --no-verify origin HEAD')"
assert_eq push_no_verify_denied 1 "$(denied)"
run_hook "$G" "$(bash_cmd 'git config --unset core.hooksPath')"
assert_eq hookspath_unset_denied 1 "$(denied)"
run_hook "$G" "$(bash_cmd 'git -c core.hooksPath=/dev/null commit -m x')"
assert_eq hookspath_override_denied 1 "$(denied)"
run_hook "$G" "$(bash_cmd 'git commit -am x')"
assert_eq plain_commit_left_to_git_hook "" "$OUT"
run_hook "$G" "$(bash_cmd 'git push -u origin HEAD')"
assert_eq plain_push_left_to_git_hook "" "$OUT"
run_hook "$G" "$(bash_cmd 'git status')"
assert_eq other_bash_noop "" "$OUT"

finish
