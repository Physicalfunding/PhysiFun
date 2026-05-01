-- ProjectPhase enum 値リネーム (#192 PR1)
-- PREPARATION → READY, COMPLETED → ONGOING
-- Issue 仕様: 本番データなし（staging のみ）。`ALTER TYPE ... RENAME VALUE` でインプレース更新。

ALTER TYPE "ProjectPhase" RENAME VALUE 'PREPARATION' TO 'READY';
ALTER TYPE "ProjectPhase" RENAME VALUE 'COMPLETED' TO 'ONGOING';
