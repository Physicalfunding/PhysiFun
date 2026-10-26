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
run_hook "$G" "$(edit Edit /repo/packages/domain/src/project/__tests__/a.test.ts)"
assert_eq green_test "" "$OUT"

# --- 🟡（通常の機能実装は許可） ---
run_hook "$G" "$(edit Edit /repo/packages/application/src/project/CreateProjectDraftUseCase.ts)"
assert_eq yellow_usecase "" "$OUT"
run_hook "$G" "$(edit Write /repo/packages/domain/src/project/Project.ts)"
assert_eq yellow_domain "" "$OUT"
run_hook "$G" "$(edit Edit /repo/apps/web/src/app/api/leader-applications/route.ts)"
assert_eq yellow_api_route "" "$OUT"
run_hook "$G" "$(edit Edit /repo/packages/infrastructure/src/project/KyselyProjectRepository.ts)"
assert_eq yellow_infra_repository "" "$OUT"

# --- 🔴（許可リストに無い） ---
run_hook "$G" "$(edit Edit /repo/packages/infrastructure/atlas/schema.sql)"
assert_eq red_atlas 1 "$(denied)"
run_hook "$G" "$(edit Edit /repo/package.json)"
assert_eq red_package_json 1 "$(denied)"
run_hook "$G" "$(edit Edit /repo/apps/web/next.config.ts)"
assert_eq red_next_config 1 "$(denied)"
run_hook "$G" "$(edit Edit /repo/CLAUDE.md)"
assert_eq claude_md_denied 1 "$(denied)"
run_hook "$G" "$(edit Edit /repo/.claude/skills/dev/SKILL.md)"
assert_eq dotclaude_md_denied 1 "$(denied)"
run_hook "$G" "$(edit Write /repo/.claude/cloud-allowlist)"
assert_eq allowlist_denied 1 "$(denied)"
run_hook "$G" "$(edit Edit /repo/.github/workflows/ci.yml)"
assert_eq github_denied 1 "$(denied)"

# --- 🔴（🟡のパスに一致するが「常に拒否」が優先: 認証・DB クライアント・実行環境） ---
run_hook "$G" "$(edit Edit /repo/apps/web/src/lib/auth.ts)"
assert_eq red_web_auth 1 "$(denied)"
run_hook "$G" "$(edit Edit /repo/apps/admin/src/lib/auth-constants.ts)"
assert_eq red_admin_auth_constants 1 "$(denied)"
run_hook "$G" "$(edit Edit /repo/apps/web/src/lib/session.ts)"
assert_eq red_session 1 "$(denied)"
run_hook "$G" "$(edit Edit /repo/apps/web/src/lib/di/auth.ts)"
assert_eq red_di_auth 1 "$(denied)"
run_hook "$G" "$(edit Edit /repo/apps/admin/src/lib/api/auth.ts)"
assert_eq red_api_auth_lib 1 "$(denied)"
run_hook "$G" "$(edit Edit /repo/apps/web/src/middleware.ts)"
assert_eq red_middleware 1 "$(denied)"
run_hook "$G" "$(edit Edit /repo/apps/web/src/app/api/auth/[...nextauth]/route.ts)"
assert_eq red_api_auth_route 1 "$(denied)"
run_hook "$G" "$(edit Edit /repo/apps/web/src/app/api/cron/process-outbox/route.ts)"
assert_eq red_cron_route 1 "$(denied)"
run_hook "$G" "$(edit Edit /repo/apps/web/src/types/next-auth.d.ts)"
assert_eq red_next_auth_types 1 "$(denied)"
run_hook "$G" "$(edit Edit /repo/packages/infrastructure/src/admin-account/KyselyAdminAuthGcAdapter.ts)"
assert_eq red_auth_adapter 1 "$(denied)"
run_hook "$G" "$(edit Edit /repo/packages/infrastructure/src/admin-account/magicLinkHmac.ts)"
assert_eq red_magic_link 1 "$(denied)"
run_hook "$G" "$(edit Edit /repo/packages/infrastructure/src/database/kysely/types.ts)"
assert_eq red_kysely_types 1 "$(denied)"
run_hook "$G" "$(edit Edit /repo/packages/infrastructure/src/security/BcryptPasswordHasher.ts)"
assert_eq red_security 1 "$(denied)"
run_hook "$G" "$(edit Edit /repo/packages/server-shared/src/csrf.ts)"
assert_eq red_csrf 1 "$(denied)"

# --- パス・環境の扱い ---
run_hook "$G" "$(edit Edit /tmp/scratch.txt)"
assert_eq outside_repo_allowed "" "$OUT"
run_hook "$G" "$(edit Edit /repo/docs/../packages/infrastructure/atlas/schema.sql)"
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
