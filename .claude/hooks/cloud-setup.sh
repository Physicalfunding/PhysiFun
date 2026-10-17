#!/usr/bin/env bash
# SessionStart hook: クラウドセッションの準備（依存インストール）
# ローカルでは何もしない。失敗してもセッションは止めず、結果を stdout（Claude の文脈に入る）で知らせる。
# docs-repository はここでは clone しない（クラウドの git 認証はセッションに付いた repo にしか効かないため）。
# 仕様が必要になったら、Claude がセッションに docs-repository を追加する。
# 参照: docs/guides/ai-harness.md P1

[[ "${CLAUDE_CODE_REMOTE:-}" == "true" ]] || exit 0

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# commit・push の中身を判定する git hook を、この repo（PhysiFun）にだけ有効にする
if git -C "$PROJECT_DIR" config core.hooksPath .claude/git-hooks 2>/dev/null; then
  echo "git hooks: ok（.claude/git-hooks の pre-commit / pre-push が有効）"
else
  echo "git hooks: failed（commit・push のガードが効かない）"
fi

if (cd "$PROJECT_DIR" 2>/dev/null && bun install --frozen-lockfile >/dev/null 2>&1); then
  echo "bun install: ok"
else
  echo "bun install: failed（lint・テストが動かない可能性がある）"
fi

if [[ -d "$PROJECT_DIR/../docs-repository/.git" ]]; then
  echo "docs-repository: ../docs-repository にある"
else
  echo "docs-repository: このセッションには付いていない。最新仕様や plan skill が必要なら、Physicalfunding/docs-repository をセッションに追加すること"
fi

exit 0
