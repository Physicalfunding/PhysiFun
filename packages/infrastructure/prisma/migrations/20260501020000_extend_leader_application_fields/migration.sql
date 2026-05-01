-- LeaderApplication 拡張 (Issue #192 PR3)
--
-- 応募フォーム拡張に伴うフィールド追加・改名・廃止を行う。
-- Issue 仕様: Phase 1 は本番データなし（staging のみ）。
-- 既存 PENDING/REJECTED レコードへ migration を適用するため `progress` には
-- DEFAULT 'PLANNING'、`recruitmentTypes` には DEFAULT '{}' を設定する。
-- アプリケーション層では `recruitmentTypes` を 1 件以上必須として扱う。

-- 1. 新 enum 追加（既存 RecruitmentType { ACTIVITY } との衝突回避）
CREATE TYPE "LeaderApplicationRecruitmentType" AS ENUM ('TIME', 'SKILL_ITEM');

-- 2. plannedActivities → activityContent へリネーム（NOT NULL → NULLABLE）
ALTER TABLE "leader_applications" RENAME COLUMN "plannedActivities" TO "activityContent";
ALTER TABLE "leader_applications" ALTER COLUMN "activityContent" DROP NOT NULL;

-- 3. 応募スナップショット用フィールド
ALTER TABLE "leader_applications" ADD COLUMN "phoneNumber" TEXT;

-- 4. progress（必須・既存行向け DEFAULT 'PLANNING' で適用）
ALTER TABLE "leader_applications" ADD COLUMN "progress" "ProjectPhase" NOT NULL DEFAULT 'PLANNING';

-- 5. recruitmentTypes（必須・1件以上はアプリ層で担保。DB は配列で空デフォルト）
ALTER TABLE "leader_applications" ADD COLUMN "recruitmentTypes" "LeaderApplicationRecruitmentType"[] NOT NULL DEFAULT '{}';

-- 6. 募集詳細・リターン情報（条件付き必須はアプリ層で担保）
ALTER TABLE "leader_applications" ADD COLUMN "eventLocation"     TEXT;
ALTER TABLE "leader_applications" ADD COLUMN "eventPeriod"       TEXT;
ALTER TABLE "leader_applications" ADD COLUMN "recruitCount"      INTEGER;
ALTER TABLE "leader_applications" ADD COLUMN "skillItemNeeds"    TEXT;
ALTER TABLE "leader_applications" ADD COLUMN "skillItemDeadline" TEXT;
ALTER TABLE "leader_applications" ADD COLUMN "timeReturn"        TEXT;
ALTER TABLE "leader_applications" ADD COLUMN "skillItemReturn"   TEXT;
ALTER TABLE "leader_applications" ADD COLUMN "experienceOffered" TEXT;
