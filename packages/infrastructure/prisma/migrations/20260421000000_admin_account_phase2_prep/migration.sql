-- ================================================================
-- Phase 2 準備: Admin アカウント分離 (#140 / #144)
--
-- - 運営権限を Account.roles ADMIN から切り出し、独立した
--   AdminAccount / AdminSession / AdminAuditLog に移す。
-- - 本番リリース前のため Zero-Downtime 不要。既存の ADMIN 関連
--   データは本 migration 内で破棄する (`本番データなし` 前提)。
-- - `project_review_feedbacks.reviewerId` は AdminAccount 参照に
--   付け替える。既存行は参照先 (AdminAccount) が存在しないため
--   migration 冒頭で truncate する。
-- ================================================================

-- Pre-migration cleanup (本番データなし前提)
-- project_review_feedbacks は Account → AdminAccount の FK 付け替えに備え全削除
DELETE FROM "project_review_feedbacks";

-- ADMIN ロールが残っていると Role enum の再定義 (USING ::text::"Role_new"[]) が
-- "invalid input value" で失敗するため、先に除去する。
UPDATE "accounts" SET "roles" = array_remove("roles", 'ADMIN'::"Role");

-- CreateEnum
CREATE TYPE "AdminAccountStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('SUPPORTER', 'LEADER');
ALTER TABLE "accounts" ALTER COLUMN "roles" TYPE "Role_new"[] USING ("roles"::text::"Role_new"[]);
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "project_review_feedbacks" DROP CONSTRAINT "project_review_feedbacks_reviewerId_fkey";

-- AlterTable
ALTER TABLE "leader_applications" ADD COLUMN     "reviewedBy" TEXT;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "forcedUnpublishedBy" TEXT,
ADD COLUMN     "reviewedBy" TEXT;

-- CreateTable
CREATE TABLE "admin_accounts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "totpSecret" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "recoveryCodes" TEXT[],
    "status" "AdminAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "adminAccountId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "adminAccountId" TEXT NOT NULL,
    "adminSessionId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_accounts_email_key" ON "admin_accounts"("email");

-- CreateIndex
CREATE INDEX "admin_accounts_status_idx" ON "admin_accounts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "admin_sessions_sessionToken_key" ON "admin_sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "admin_sessions_adminAccountId_idx" ON "admin_sessions"("adminAccountId");

-- CreateIndex
CREATE INDEX "admin_sessions_expires_idx" ON "admin_sessions"("expires");

-- CreateIndex
CREATE INDEX "admin_audit_logs_adminAccountId_idx" ON "admin_audit_logs"("adminAccountId");

-- CreateIndex
CREATE INDEX "admin_audit_logs_adminSessionId_idx" ON "admin_audit_logs"("adminSessionId");

-- CreateIndex
CREATE INDEX "admin_audit_logs_createdAt_idx" ON "admin_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "admin_audit_logs_targetType_targetId_idx" ON "admin_audit_logs"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "leader_applications_reviewedBy_idx" ON "leader_applications"("reviewedBy");

-- CreateIndex
CREATE INDEX "projects_reviewedBy_idx" ON "projects"("reviewedBy");

-- CreateIndex
CREATE INDEX "projects_forcedUnpublishedBy_idx" ON "projects"("forcedUnpublishedBy");

-- AddForeignKey
ALTER TABLE "leader_applications" ADD CONSTRAINT "leader_applications_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "admin_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "admin_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_forcedUnpublishedBy_fkey" FOREIGN KEY ("forcedUnpublishedBy") REFERENCES "admin_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_review_feedbacks" ADD CONSTRAINT "project_review_feedbacks_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "admin_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_adminAccountId_fkey" FOREIGN KEY ("adminAccountId") REFERENCES "admin_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_adminAccountId_fkey" FOREIGN KEY ("adminAccountId") REFERENCES "admin_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_adminSessionId_fkey" FOREIGN KEY ("adminSessionId") REFERENCES "admin_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "leader_application_outbox_messages_sentAt_deadLetteredAt_nextRe" RENAME TO "leader_application_outbox_messages_sentAt_deadLetteredAt_ne_idx";

