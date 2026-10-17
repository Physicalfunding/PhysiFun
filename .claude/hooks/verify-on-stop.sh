#!/usr/bin/env bash
# Stop hook: Claude が作業を終えようとした時点で `bun run check` を実行し、失敗していたら終了を差し戻す
# - origin/main との差分（未 push のコミットと未コミットの変更）にコードの変更があり、前回の結果から差分が変わっているときだけ実行する
#   （docs / *.md だけの変更は対象外。merge・rebase などの途中は何もしない）
# - 連続の差し戻しは 3 回まで。超えたら終了を許可し、その差分では以後差し戻さない（3 回目に「直せなければ報告して終了」と伝える）
# - infrastructure の結合テスト（Docker）と build は対象外（CI に任せる）
# 参照: docs/guides/ai-harness.md P4

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
VERIFY_CMD="${VERIFY_CMD:-bun run check}"
MAX_BLOCKS=3
INPUT=$(cat)
ACTIVE=$(jq -r '.stop_hook_active // false' <<<"$INPUT" 2>/dev/null)

cd "$ROOT" 2>/dev/null || exit 0
git rev-parse --verify -q HEAD >/dev/null 2>&1 || exit 0

GIT_DIR=$(git rev-parse --git-dir)
for marker in MERGE_HEAD CHERRY_PICK_HEAD REVERT_HEAD rebase-merge rebase-apply; do
  [[ -e "$GIT_DIR/$marker" ]] && exit 0
done

# 基準: origin/main との共通の祖先（無ければ HEAD）。未 push のコミットも対象にする
BASE=$(git merge-base HEAD origin/main 2>/dev/null || git rev-parse HEAD)

STATE_DIR="$ROOT/.claude/.state"
not_state() { grep -v -E '^\.claude/\.state/'; }

CHANGED=$({
  git -c core.quotePath=false diff --name-only --no-renames "$BASE"
  git -c core.quotePath=false ls-files -o --exclude-standard
} | not_state | grep -v -E '(\.md$|^docs/)')
[[ -z "$CHANGED" ]] && exit 0

HASH=$({
  git diff "$BASE"
  git ls-files -o --exclude-standard | not_state | while IFS= read -r f; do
    echo "$f"
    cat "$f" 2>/dev/null
  done
} | shasum | cut -d' ' -f1)

mkdir -p "$STATE_DIR"
for f in verify-last-ok verify-gave-up; do
  [[ -f "$STATE_DIR/$f" && "$(cat "$STATE_DIR/$f")" == "$HASH" ]] && exit 0
done
[[ "$ACTIVE" == "true" ]] || echo 0 >"$STATE_DIR/verify-blocks"

if OUTPUT=$(bash -c "$VERIFY_CMD" 2>&1); then
  echo "$HASH" >"$STATE_DIR/verify-last-ok"
  echo 0 >"$STATE_DIR/verify-blocks"
  exit 0
fi

COUNT=$(($(cat "$STATE_DIR/verify-blocks" 2>/dev/null || echo 0) + 1))
if ((COUNT > MAX_BLOCKS)); then
  echo 0 >"$STATE_DIR/verify-blocks"
  echo "$HASH" >"$STATE_DIR/verify-gave-up" # この差分では以後差し戻さない（変更されたらまた検証する）
  exit 0
fi
echo "$COUNT" >"$STATE_DIR/verify-blocks"

REASON="$VERIFY_CMD が失敗しました（$COUNT/$MAX_BLOCKS 回目）。修正してから終了してください。"
if ((COUNT == MAX_BLOCKS)); then
  REASON="これが最後の差し戻しです。直せない場合は、失敗内容をユーザーに報告して終了してください。"$'\n'"$REASON"
fi
REASON+=$'\n\n'"$(tail -80 <<<"$OUTPUT")"

jq -cn --arg r "$REASON" '{decision: "block", reason: $r}'
exit 0
