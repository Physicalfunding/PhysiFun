#!/usr/bin/env bash
# SessionStart hook: クラウドセッションの準備（docs-repository の clone と依存インストール）
# ローカルでは何もしない。失敗してもセッションは止めず、結果を stdout（Claude の文脈に入る）で知らせる。
# 参照: docs/guides/ai-harness.md P1

[[ "${CLAUDE_CODE_REMOTE:-}" == "true" ]] || exit 0

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
DOCS_DIR="$PROJECT_DIR/../docs-repository"

if [[ -d "$DOCS_DIR/.git" ]] ||
  git clone --quiet --depth 1 https://github.com/Physicalfunding/docs-repository.git "$DOCS_DIR" >/dev/null 2>&1; then
  echo "docs-repository: ok"
else
  echo "docs-repository: failed（../docs-repository の仕様は参照できない）"
fi

if (cd "$PROJECT_DIR" && bun install --frozen-lockfile >/dev/null 2>&1); then
  echo "bun install: ok"
else
  echo "bun install: failed（lint・テストが動かない可能性がある）"
fi

exit 0
