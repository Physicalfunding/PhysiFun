#!/usr/bin/env bash
# PostToolUse hook: Claude が書いた .ts / .tsx に Prettier をかけてから ESLint をかける
# ESLint の違反は exit 2 + stderr で Claude に返す（stdout は Claude に届かない）。
# ルールの正は ESLint の設定（ルートの eslint.config.mjs と apps/*/eslint.config.mjs）。
# 参照: docs/guides/ai-harness.md P3

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
FILE=$(jq -r '.tool_input.file_path // empty')

[[ -n "$FILE" && -f "$FILE" ]] || exit 0
[[ "$FILE" == *.ts || "$FILE" == *.tsx ]] || exit 0
[[ "$FILE" == "$ROOT/"* ]] || exit 0
REL="${FILE#"$ROOT"/}"

(cd "$ROOT" && bunx prettier --write --log-level silent "$REL" >/dev/null 2>&1)

# ESLint は設定ファイルのある場所で実行する（apps は各アプリ、それ以外はルート）
case "$REL" in
  apps/web/* | apps/admin/*)
    DIR="$(cut -d/ -f1-2 <<<"$REL")"
    ;;
  *) DIR="." ;;
esac
TARGET="${REL#"$DIR"/}"
[[ "$DIR" == "." ]] && TARGET="$REL"

OUTPUT=$(cd "$ROOT/$DIR" && bunx eslint --no-warn-ignored "$TARGET" 2>&1)
STATUS=$?

if ((STATUS == 1)); then
  {
    echo "lint-on-edit: $REL に ESLint の違反があります。修正してください（ルールの説明は docs/guides/ai-harness.md P3）。"
    head -50 <<<"$OUTPUT"
  } >&2
  exit 2
fi

exit 0
