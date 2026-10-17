#!/usr/bin/env bash
# .claude/git-hooks（pre-commit / pre-push）と、それを有効にする cloud-setup.sh のテスト
# 一時的な git repo（origin は bare repo）で、実際に commit・push して確かめる。

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
mkdir -p docs packages/domain/src
echo a >README.md && echo b >packages/domain/src/b.ts
git add -A && git commit -qm init
git remote add origin "$T/origin.git" && git push -q origin main
git config core.hooksPath "$HOOKS_DIR"

# --- pre-commit ---
echo x >docs/仕様.md && git add -A
try japanese_path_commit_allowed 0 git commit -qm docs

echo x >packages/domain/src/a.ts && git add -A
try red_commit_blocked 1 git commit -qm red
assert_eq red_commit_names_file 1 "$(grep -c 'packages/domain/src/a.ts' <<<"$ERR")"
git reset -q && rm packages/domain/src/a.ts

try chained_write_commit_blocked 1 bash -c 'echo x >packages/domain/src/c.ts && git add -A && git commit -qm x'
git reset -q && rm -f packages/domain/src/c.ts

echo changed >packages/domain/src/b.ts
try commit_am_blocked 1 git commit -qam x
git checkout -q -- packages/domain/src/b.ts

# --- pre-push ---
git switch -q -c green
echo y >docs/more.md && git add -A && git commit -qm docs2
try green_new_branch_push_allowed 0 git push -q -u origin green

git switch -q -c redb
echo z >packages/domain/src/r.ts && git add -A && git commit -qm red --no-verify
try red_push_blocked 1 git push -q -u origin redb
assert_eq red_push_names_file 1 "$(grep -c 'packages/domain/src/r.ts' <<<"$ERR")"

git switch -q green
try push_other_branch_by_name_blocked 1 git push -q origin redb

# 既に赤を含むリモートブランチに、緑のコミットだけを足す（PR ブランチの続きを想定）
git switch -q redb
git push -q --no-verify origin redb
echo w >docs/again.md && git add -A && git commit -qm docs3
try existing_branch_checks_only_new_commits 0 git push -q origin redb

try delete_branch_push_allowed 0 git push -q origin --delete green

# ローカル（CLAUDE_CODE_REMOTE なし）では何もしない
git switch -q main
echo l >packages/domain/src/l.ts && git add -A
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
