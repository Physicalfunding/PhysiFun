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

# --- 🟢 ---
run_hook "$G" "$(edit Edit /repo/docs/specs/README.md)"
assert_eq green_docs "" "$OUT"
run_hook "$G" "$(edit Write /repo/apps/web/src/components/Button.tsx)"
assert_eq green_component "" "$OUT"
run_hook "$G" "$(edit Edit /repo/tests/e2e/src/specs/01-login.spec.ts)"
assert_eq green_e2e "" "$OUT"
run_hook "$G" "$(edit Edit /repo/packages/infrastructure/test/project/KyselyProject.vitest.ts)"
assert_eq green_vitest_outside_src "" "$OUT"

# --- 🟡（通常の機能実装は許可） ---
run_hook "$G" "$(edit Edit /repo/packages/application/src/project/CreateProjectDraftUseCase.ts)"
assert_eq yellow_usecase "" "$OUT"
run_hook "$G" "$(edit Write /repo/packages/domain/src/project/Project.ts)"
assert_eq yellow_domain "" "$OUT"
run_hook "$G" "$(edit Edit /repo/apps/web/src/app/api/leader-applications/route.ts)"
assert_eq yellow_api_route "" "$OUT"
run_hook "$G" "$(edit Edit /repo/packages/infrastructure/src/project/KyselyProjectRepository.ts)"
assert_eq yellow_infra_repository "" "$OUT"

# --- 🟡（以前は🔴だったもの: 依存・設定・認証・DB クライアント・skills・CLAUDE.md） ---
run_hook "$G" "$(edit Edit /repo/package.json)"
assert_eq yellow_package_json "" "$OUT"
run_hook "$G" "$(edit Edit /repo/bun.lock)"
assert_eq yellow_bun_lock "" "$OUT"
run_hook "$G" "$(edit Edit /repo/vitest.config.ts)"
assert_eq yellow_vitest_config "" "$OUT"
run_hook "$G" "$(edit Edit /repo/apps/web/next.config.ts)"
assert_eq yellow_next_config "" "$OUT"
run_hook "$G" "$(edit Edit /repo/apps/web/src/lib/auth.ts)"
assert_eq yellow_web_auth "" "$OUT"
run_hook "$G" "$(edit Edit /repo/apps/web/src/proxy.ts)"
assert_eq yellow_proxy "" "$OUT"
run_hook "$G" "$(edit Edit /repo/apps/web/src/app/api/cron/process-outbox/route.ts)"
assert_eq yellow_cron_route "" "$OUT"
run_hook "$G" "$(edit Edit /repo/packages/infrastructure/src/database/kysely/client.ts)"
assert_eq yellow_kysely_client "" "$OUT"
run_hook "$G" "$(edit Edit /repo/packages/infrastructure/atlas.hcl)"
assert_eq yellow_atlas_hcl "" "$OUT"
run_hook "$G" "$(edit Edit /repo/CLAUDE.md)"
assert_eq yellow_claude_md "" "$OUT"
run_hook "$G" "$(edit Edit /repo/.claude/skills/dev/SKILL.md)"
assert_eq yellow_skill "" "$OUT"
run_hook "$G" "$(edit Edit /repo/.claude/workflows/full-review.js)"
assert_eq yellow_workflow "" "$OUT"

# --- 🔴（Docker が要る作業: Atlas のスキーマ・マイグレーション、kysely-codegen の型） ---
run_hook "$G" "$(edit Edit /repo/packages/infrastructure/atlas/schema.sql)"
assert_eq red_atlas_schema 1 "$(denied)"
run_hook "$G" "$(edit Write /repo/packages/infrastructure/atlas/migrations/20261028000000.sql)"
assert_eq red_atlas_migration 1 "$(denied)"
run_hook "$G" "$(edit Edit /repo/packages/infrastructure/src/database/kysely/types.ts)"
assert_eq red_kysely_types 1 "$(denied)"

# --- 🔴（ガードと CI。hooks の下の __tests__/ も拒否が優先） ---
run_hook "$G" "$(edit Edit /repo/.github/workflows/ci.yml)"
assert_eq red_github 1 "$(denied)"
run_hook "$G" "$(edit Write /repo/.claude/cloud-allowlist)"
assert_eq red_allowlist 1 "$(denied)"
run_hook "$G" "$(edit Edit /repo/.claude/hooks/cloud-scope-guard.sh)"
assert_eq red_hook 1 "$(denied)"
run_hook "$G" "$(edit Edit /repo/.claude/hooks/lib/allowlist.sh)"
assert_eq red_hook_lib 1 "$(denied)"
run_hook "$G" "$(edit Edit /repo/.claude/hooks/__tests__/cloud-scope-guard.test.sh)"
assert_eq red_hook_test 1 "$(denied)"
run_hook "$G" "$(edit Edit /repo/.claude/git-hooks/pre-push)"
assert_eq red_git_hook 1 "$(denied)"
run_hook "$G" "$(edit Edit /repo/.claude/settings.json)"
assert_eq red_settings 1 "$(denied)"
run_hook "$G" "$(edit Write /repo/.claude/settings.local.json)"
assert_eq red_settings_local 1 "$(denied)"
run_hook "$G" "$(edit Edit /repo/.git/config)"
assert_eq red_git_config 1 "$(denied)"
run_hook "$G" "$(edit Write /repo/.git/hooks/pre-commit)"
assert_eq red_git_dir_hooks 1 "$(denied)"
run_hook "$G" "$(edit Edit /repo/.gitignore)"
assert_eq yellow_gitignore_not_git_dir "" "$OUT"

# --- パス・環境の扱い ---
run_hook "$G" "$(edit Edit /tmp/scratch.txt)"
assert_eq outside_repo_allowed "" "$OUT"
run_hook "$G" "$(edit Edit /repo/docs/../docs/specs/README.md)"
assert_eq dotdot_denied_even_if_green 1 "$(denied)"
# 正規化されていないパスは「常に拒否」に当たらず * で許可されてしまうので、書き方の段階で拒否する
run_hook "$G" "$(edit Edit /repo/./.claude/cloud-allowlist)"
assert_eq dot_segment_denied 1 "$(denied)"
run_hook "$G" "$(edit Edit /repo//.claude/settings.json)"
assert_eq double_slash_denied 1 "$(denied)"
run_hook "$G" "$(edit Edit ./.claude/git-hooks/pre-commit)"
assert_eq relative_dot_slash_denied 1 "$(denied)"
run_hook "$G" "$(edit Edit /repo/packages/infrastructure/atlas/.)"
assert_eq trailing_dot_denied 1 "$(denied)"
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
run_hook "$G" "$(bash_cmd 'git config core.hooksPath /dev/null')"
assert_eq hookspath_set_denied 1 "$(denied)"
run_hook "$G" "$(bash_cmd 'cd sub && git commit --no-verify -m x')"
assert_eq chained_no_verify_denied 1 "$(denied)"
# 誤検知しない（読むだけ・文章中の言及）
run_hook "$G" "$(bash_cmd 'git config core.hooksPath')"
assert_eq hookspath_read_allowed "" "$OUT"
run_hook "$G" "$(bash_cmd 'git config --get core.hooksPath')"
assert_eq hookspath_get_allowed "" "$OUT"
run_hook "$G" "$(bash_cmd 'gh api repos/o/r/pulls -f title=t -f body="cloud-setup.sh が core.hooksPath を設定する。--no-verify は拒否される"')"
assert_eq pr_body_mention_allowed "" "$OUT"
run_hook "$G" "$(bash_cmd 'git commit -m "docs: --no-verify の説明を追加"')"
assert_eq commit_message_mention_allowed "" "$OUT"
run_hook "$G" "$(bash_cmd 'git commit -am x')"
assert_eq plain_commit_left_to_git_hook "" "$OUT"
run_hook "$G" "$(bash_cmd 'git push -u origin HEAD')"
assert_eq plain_push_left_to_git_hook "" "$OUT"
run_hook "$G" "$(bash_cmd 'git status')"
assert_eq other_bash_noop "" "$OUT"

finish
