#!/usr/bin/env bash
# .claude/hooks/__tests__/*.test.sh をすべて実行する。1 つでも失敗したら exit 1。

cd "$(dirname "$0")" || exit 1
status=0
for t in ./*.test.sh; do
  echo "== $t"
  bash "$t" || status=1
done
exit $status
