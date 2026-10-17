-- #262: 公開まわりの値（slug / publishRequestedAt / publishedAt）を、ドメインのルールに合わせて埋め直す。
-- スキーマは変えないデータだけの修正。何度流しても結果は同じ（条件に合う行が無ければ何もしない）。

-- 1. 公開中なのに slug が無いプロジェクトに、id と同じ値の slug を発行する。
--    これまで slug を書くコードが無く、公開ページ /projects/[slug] で表示できなかった。
UPDATE "projects" SET "slug" = "id"
WHERE "status" = 'PUBLISHED' AND "slug" IS NULL;

-- 2. 審査待ちなのに公開申請日時が無いプロジェクトは、updatedAt を申請日時とみなす。
--    審査待ちの間に編集すると DRAFT に戻るため、審査待ちの行の updatedAt は申請した時刻と同じになる。
UPDATE "projects" SET "publishRequestedAt" = "updatedAt"
WHERE "status" = 'PENDING_REVIEW' AND "publishRequestedAt" IS NULL;

-- 3. 下書きに戻ったプロジェクトに残っている公開申請日時・公開日時を消す。
--    これまで差戻・取下げ・非公開化のあとも publishedAt が残っていた。slug は再公開用に残す。
UPDATE "projects" SET "publishRequestedAt" = NULL, "publishedAt" = NULL
WHERE "status" = 'DRAFT' AND ("publishRequestedAt" IS NOT NULL OR "publishedAt" IS NOT NULL);
