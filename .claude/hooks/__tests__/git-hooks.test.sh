#!/usr/bin/env bash
# .claude/git-hooks（pre-commit / pre-push）と、それを有効にする cloud-setup.sh のテスト
# 一時的な git repo（origin は bare repo）で、実際に commit・push して確かめる。
# 🔴の例には「常に拒否」の packages/infrastructure/atlas/*.sql（Docker が要る作業）と .github/workflows/ci.yml（CI）を使う。

cd "$(dirname "$0")" || exit 1
source ./lib.sh
HOOKS_DIR="$(cd ../../git-hooks && pwd)"
SETUP="$(cd .. && pwd)/cloud-setup.sh"

export CLAUDE_CODE_REMOTE=true
export CLOUD_ALLOWLIST="$(cd ../.. && pwd)/cloud-allowlist"

# try <name> <expected_code> <command...> → コマンドを実行し、終了コードを比べる（stderr は ERR に入る）
try() {
  local name="$1" expected="$2"
  shift 2
  ERR=$("$@" 2>&1 >/dev/null)
  assert_eq "$name" "$expected" "$([[ $? -eq 0 ]] && echo 0 || echo 1)"
}

T=$(mktemp -d)
git init -q --bare "$T/origin.git"
git init -q -b main "$T/work"
cd "$T/work" || exit 1
git config user.email t@example.com && git config user.name t
mkdir -p docs packages/domain/src packages/infrastructure/atlas .github/workflows
echo a >README.md && echo b >packages/infrastructure/atlas/b.sql
git add -A && git commit -qm init
git remote add origin "$T/origin.git" && git push -q origin main
git config core.hooksPath "$HOOKS_DIR"

# --- pre-commit ---
echo x >docs/仕様.md && git add -A
try japanese_path_commit_allowed 0 git commit -qm docs

echo x >packages/domain/src/a.ts && git add -A
try yellow_commit_allowed 0 git commit -qm yellow

echo '{}' >package.json && git add -A
try deps_commit_allowed 0 git commit -qm deps

echo x >packages/infrastructure/atlas/a.sql && git add -A
try red_commit_blocked 1 git commit -qm red
assert_eq red_commit_names_file 1 "$(grep -c 'packages/infrastructure/atlas/a.sql' <<<"$ERR")"
git reset -q && rm packages/infrastructure/atlas/a.sql

echo x >.github/workflows/ci.yml && git add -A
try red_github_commit_blocked 1 git commit -qm ci
assert_eq red_github_commit_names_file 1 "$(grep -c '.github/workflows/ci.yml' <<<"$ERR")"
git reset -q && rm .github/workflows/ci.yml

try chained_write_commit_blocked 1 bash -c 'echo x >packages/infrastructure/atlas/c.sql && git add -A && git commit -qm x'
git reset -q && rm -f packages/infrastructure/atlas/c.sql

echo changed >packages/infrastructure/atlas/b.sql
try commit_am_blocked 1 git commit -qam x
git checkout -q -- packages/infrastructure/atlas/b.sql

# --- pre-push ---
git switch -q -c green
echo y >docs/more.md && git add -A && git commit -qm docs2
try green_new_branch_push_allowed 0 git push -q -u origin green

git switch -q -c yellow
echo y >packages/domain/src/y.ts && git add -A && git commit -qm yellow2
try yellow_new_branch_push_allowed 0 git push -q -u origin yellow

git switch -q -c redb
echo z >packages/infrastructure/atlas/r.sql && git add -A && git commit -qm red --no-verify
try red_push_blocked 1 git push -q -u origin redb
assert_eq red_push_names_file 1 "$(grep -c 'packages/infrastructure/atlas/r.sql' <<<"$ERR")"

git switch -q green
try push_other_branch_by_name_blocked 1 git push -q origin redb

# 既に赤を含むリモートブランチに、緑のコミットだけを足す（PR ブランチの続きを想定）
git switch -q redb
git push -q --no-verify origin redb
echo w >docs/again.md && git add -A && git commit -qm docs3
try existing_branch_checks_only_new_commits 0 git push -q origin redb

try delete_branch_push_allowed 0 git push -q origin --delete green

# ローカルの origin/main が古いまま、新しい main から切ったブランチを push する（クラウドの clone で起きた）
OLD_MAIN=$(git rev-parse origin/main)
git clone -q -b main "$T/origin.git" "$T/other" &&
  (cd "$T/other" && git config user.email t@example.com && git config user.name t &&
    echo m >packages/infrastructure/atlas/m.sql && git add -A && git commit -qm "main で進んだ変更" && git push -q origin main)
git fetch -q origin && git switch -q -C main origin/main
git update-ref refs/remotes/origin/main "$OLD_MAIN"
git switch -q -c green2
mkdir -p docs && echo v >docs/stale.md && git add -A && git commit -qm docs4
try stale_origin_main_push_allowed 0 git push -q -u origin green2

# PR ブランチ（緑）に、main で進んだ赤の変更をマージして push する（main への追従）
(cd "$T/other" && git pull -q origin main && echo n >packages/infrastructure/atlas/n.sql && git add -A &&
  git commit -qm "main でさらに進んだ変更" && git push -q origin main)
git fetch -q origin
git merge -q --no-edit origin/main
try merge_main_into_green_branch_allowed 0 git push -q origin green2
echo r2 >packages/infrastructure/atlas/r2.sql && git add -A && git commit -qm red2 --no-verify
try red_after_merge_still_blocked 1 git push -q origin green2

# ローカル（CLAUDE_CODE_REMOTE なし）では何もしない
git switch -q main
echo l >packages/infrastructure/atlas/l.sql && git add -A
try local_commit_noop 0 env CLAUDE_CODE_REMOTE= git commit -qm local
git reset -q --hard origin/main

# --- cloud-setup.sh が PhysiFun の repo にだけ git hooks を設定する ---
git init -q "$T/proj"
git init -q "$T/docs-repository"
CLAUDE_PROJECT_DIR="$T/proj" bash "$SETUP" >/dev/null 2>&1
assert_eq setup_sets_hookspath ".claude/git-hooks" "$(git -C "$T/proj" config core.hooksPath)"
assert_eq setup_leaves_other_repo "" "$(git -C "$T/docs-repository" config core.hooksPath)"
git init -q "$T/local"
CLAUDE_CODE_REMOTE= CLAUDE_PROJECT_DIR="$T/local" bash "$SETUP" >/dev/null 2>&1
assert_eq setup_local_noop "" "$(git -C "$T/local" config core.hooksPath)"

cd / && rm -rf "$T"
finish
