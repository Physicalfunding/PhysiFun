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

# --- commit / push / PR ゲート（一時的な git repo で検証） ---
T=$(mktemp -d)
git init -q --bare "$T/origin.git"
git init -q -b main "$T/work"
cd "$T/work" || exit 1
git config user.email t@example.com && git config user.name t
mkdir -p docs packages/domain/src
echo a >README.md && echo b >packages/domain/src/b.ts
git add -A && git commit -qm init
git remote add origin "$T/origin.git" && git push -q origin main
export CLAUDE_PROJECT_DIR="$T/work"

echo x >docs/仕様.md && git add -A
run_hook "$G" "$(bash_cmd 'git commit -m x')"
assert_eq japanese_path_allowed "" "$OUT"
git commit -qm docs

echo x >packages/domain/src/a.ts && git add -A
run_hook "$G" "$(bash_cmd 'git commit -m x')"
assert_eq red_commit_denied 1 "$(denied)"
run_hook "$G" "$(bash_cmd 'git add -A && git commit -m x')"
assert_eq chained_commit_checked 1 "$(denied)"
git reset -q && rm packages/domain/src/a.ts

echo changed >packages/domain/src/b.ts
run_hook "$G" "$(bash_cmd 'git commit -am x')"
assert_eq commit_am_checked 1 "$(denied)"
git checkout -q -- packages/domain/src/b.ts

echo y >docs/more.md && git add -A && git commit -qm docs2
run_hook "$G" "$(bash_cmd 'git push -u origin HEAD')"
assert_eq green_push_allowed "" "$OUT"
run_hook "$G" "$(bash_cmd 'gh pr create --title t --body b')"
assert_eq green_pr_allowed "" "$OUT"

echo z >packages/domain/src/c.ts && git add -A && git commit -qm red
run_hook "$G" "$(bash_cmd 'git push')"
assert_eq red_push_denied 1 "$(denied)"
assert_eq red_push_names_file 1 "$(grep -c 'packages/domain/src/c.ts' <<<"$OUT")"

git remote remove origin
run_hook "$G" "$(bash_cmd 'git push')"
assert_eq no_origin_denied 1 "$(grep -c 'git fetch origin main' <<<"$OUT")"

run_hook "$G" "$(bash_cmd 'git status')"
assert_eq other_bash_noop "" "$OUT"

cd / && rm -rf "$T"

finish
