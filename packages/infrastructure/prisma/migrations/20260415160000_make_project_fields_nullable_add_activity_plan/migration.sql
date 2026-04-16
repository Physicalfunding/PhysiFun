-- AlterTable: Project フィールドを nullable に変更 + activityPlan 追加
-- DRAFT 作成時は title のみ必須、他フィールドは null 許容にする

ALTER TABLE "projects" ALTER COLUMN "summary" DROP NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "story" DROP NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "leaderIntro" DROP NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "category" DROP NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "prefectureCode" DROP NOT NULL;

ALTER TABLE "projects" ADD COLUMN "activityPlan" TEXT;
