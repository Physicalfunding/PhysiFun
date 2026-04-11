-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING_EMAIL_CONFIRMATION', 'ACTIVE');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPPORTER', 'LEADER', 'ADMIN');

-- CreateEnum
CREATE TYPE "LeaderApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ProjectPhase" AS ENUM ('VISION', 'PLANNING', 'PREPARATION', 'EXECUTION', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ReviewAction" AS ENUM ('APPROVED', 'REJECTED', 'FORCE_UNPUBLISHED');

-- CreateEnum
CREATE TYPE "RecruitmentType" AS ENUM ('ACTIVITY');

-- CreateEnum
CREATE TYPE "ApprovalMode" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" "AccountStatus" NOT NULL,
    "passwordHash" TEXT,
    "roles" "Role"[],
    "activationToken" TEXT,
    "activationTokenExp" TIMESTAMP(3),
    "iconUrl" TEXT,
    "bio" TEXT,
    "snsLinks" JSONB,
    "contributedHours" INTEGER NOT NULL DEFAULT 0,
    "receivedHours" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leader_applications" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "status" "LeaderApplicationStatus" NOT NULL,
    "reviewerNote" TEXT,
    "projectTitle" TEXT NOT NULL,
    "projectSummary" TEXT NOT NULL,
    "projectStory" TEXT NOT NULL,
    "projectCategory" TEXT NOT NULL,
    "prefectureCode" TEXT NOT NULL,
    "municipality" TEXT,
    "plannedActivities" TEXT NOT NULL,
    "snsLinks" JSONB,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leader_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "ownerAccountId" TEXT NOT NULL,
    "slug" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "story" TEXT NOT NULL,
    "leaderIntro" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "category" TEXT NOT NULL,
    "prefectureCode" TEXT NOT NULL,
    "municipality" TEXT,
    "snsLinks" JSONB,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "phase" "ProjectPhase" NOT NULL DEFAULT 'VISION',
    "publishRequestedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_review_feedbacks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "action" "ReviewAction" NOT NULL,
    "note" TEXT,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_review_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_recruitments" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "RecruitmentType" NOT NULL DEFAULT 'ACTIVITY',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_recruitments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruitment_schedules" (
    "id" TEXT NOT NULL,
    "supportRecruitmentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "capacityPerHour" INTEGER NOT NULL,
    "approvalMode" "ApprovalMode" NOT NULL DEFAULT 'AUTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recruitment_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "recruitmentScheduleId" TEXT NOT NULL,
    "supporterAccountId" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "slotStart" TEXT NOT NULL,
    "companionCount" INTEGER NOT NULL DEFAULT 0,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leader_application_outbox_messages" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextRetryAt" TIMESTAMP(3),

    CONSTRAINT "leader_application_outbox_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_outbox_messages" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextRetryAt" TIMESTAMP(3),

    CONSTRAINT "project_outbox_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_activationToken_key" ON "accounts"("activationToken");

-- CreateIndex
CREATE INDEX "accounts_status_idx" ON "accounts"("status");

-- CreateIndex
CREATE INDEX "leader_applications_accountId_idx" ON "leader_applications"("accountId");

-- CreateIndex
CREATE INDEX "leader_applications_status_idx" ON "leader_applications"("status");

-- CreateIndex
CREATE INDEX "leader_applications_submittedAt_idx" ON "leader_applications"("submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");

-- CreateIndex
CREATE INDEX "projects_ownerAccountId_idx" ON "projects"("ownerAccountId");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "projects_category_idx" ON "projects"("category");

-- CreateIndex
CREATE INDEX "projects_prefectureCode_idx" ON "projects"("prefectureCode");

-- CreateIndex
CREATE INDEX "projects_publishedAt_idx" ON "projects"("publishedAt");

-- CreateIndex
CREATE INDEX "project_review_feedbacks_projectId_idx" ON "project_review_feedbacks"("projectId");

-- CreateIndex
CREATE INDEX "project_review_feedbacks_reviewerId_idx" ON "project_review_feedbacks"("reviewerId");

-- CreateIndex
CREATE INDEX "project_review_feedbacks_reviewedAt_idx" ON "project_review_feedbacks"("reviewedAt");

-- CreateIndex
CREATE INDEX "support_recruitments_projectId_idx" ON "support_recruitments"("projectId");

-- CreateIndex
CREATE INDEX "recruitment_schedules_date_idx" ON "recruitment_schedules"("date");

-- CreateIndex
CREATE UNIQUE INDEX "recruitment_schedules_supportRecruitmentId_date_key" ON "recruitment_schedules"("supportRecruitmentId", "date");

-- CreateIndex
CREATE INDEX "support_tickets_recruitmentScheduleId_idx" ON "support_tickets"("recruitmentScheduleId");

-- CreateIndex
CREATE INDEX "support_tickets_supporterAccountId_idx" ON "support_tickets"("supporterAccountId");

-- CreateIndex
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");

-- CreateIndex
CREATE INDEX "leader_application_outbox_messages_sentAt_nextRetryAt_idx" ON "leader_application_outbox_messages"("sentAt", "nextRetryAt");

-- CreateIndex
CREATE INDEX "project_outbox_messages_sentAt_nextRetryAt_idx" ON "project_outbox_messages"("sentAt", "nextRetryAt");

-- AddForeignKey
ALTER TABLE "leader_applications" ADD CONSTRAINT "leader_applications_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_ownerAccountId_fkey" FOREIGN KEY ("ownerAccountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_review_feedbacks" ADD CONSTRAINT "project_review_feedbacks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_review_feedbacks" ADD CONSTRAINT "project_review_feedbacks_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_recruitments" ADD CONSTRAINT "support_recruitments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment_schedules" ADD CONSTRAINT "recruitment_schedules_supportRecruitmentId_fkey" FOREIGN KEY ("supportRecruitmentId") REFERENCES "support_recruitments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_recruitmentScheduleId_fkey" FOREIGN KEY ("recruitmentScheduleId") REFERENCES "recruitment_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_supporterAccountId_fkey" FOREIGN KEY ("supporterAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
