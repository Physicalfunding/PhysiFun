-- LeaderApplication.experienceOffered を NOT NULL 化 (Issue #192 PR #198 review M1)
--
-- 経緯:
--   PR3 で nullable で追加されたが、アプリ層 (Zod / superRefine) では必須として扱っていた。
--   schema と application の不整合を解消するため、DB 側でも NOT NULL を強制する。
--
-- 戦略:
--   1. 既存 NULL 行を「（移行データのため未入力）」でバックフィル
--      - Phase 1 は本番データなしの想定だが、staging に残っている可能性のある
--        旧 PENDING/REJECTED 行への安全策として実施。
--   2. NOT NULL 制約を付与。

UPDATE "leader_applications"
SET "experienceOffered" = '（移行データのため未入力）'
WHERE "experienceOffered" IS NULL;

ALTER TABLE "leader_applications"
ALTER COLUMN "experienceOffered" SET NOT NULL;
