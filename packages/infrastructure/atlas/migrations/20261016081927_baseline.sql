-- Create enum type "AdminAccountStatus"
CREATE TYPE "AdminAccountStatus" AS ENUM ('ACTIVE', 'DISABLED');
-- Create "admin_accounts" table
CREATE TABLE "admin_accounts" (
  "id" text NOT NULL,
  "email" text NOT NULL,
  "status" "AdminAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "lastLoginAt" timestamp(3) NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id")
);
-- Create index "admin_accounts_email_key" to table: "admin_accounts"
CREATE UNIQUE INDEX "admin_accounts_email_key" ON "admin_accounts" ("email");
-- Create index "admin_accounts_status_idx" to table: "admin_accounts"
CREATE INDEX "admin_accounts_status_idx" ON "admin_accounts" ("status");
-- Create enum type "PublishStatus"
CREATE TYPE "PublishStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED');
-- Create enum type "ProjectPhase"
CREATE TYPE "ProjectPhase" AS ENUM ('VISION', 'PLANNING', 'READY', 'EXECUTION', 'ONGOING');
-- Create enum type "ReviewAction"
CREATE TYPE "ReviewAction" AS ENUM ('APPROVED', 'REJECTED', 'FORCE_UNPUBLISHED');
-- Create enum type "RecruitmentType"
CREATE TYPE "RecruitmentType" AS ENUM ('ACTIVITY');
-- Create "project_outbox_messages" table
CREATE TABLE "project_outbox_messages" (
  "id" text NOT NULL,
  "type" text NOT NULL,
  "payload" jsonb NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" timestamp(3) NULL,
  "attempts" integer NOT NULL DEFAULT 0,
  "lastError" text NULL,
  "nextRetryAt" timestamp(3) NULL,
  "deadLetteredAt" timestamp(3) NULL,
  "claimedAt" timestamp(3) NULL,
  "claimedBy" text NULL,
  PRIMARY KEY ("id")
);
-- Create index "project_outbox_messages_claimedBy_idx" to table: "project_outbox_messages"
CREATE INDEX "project_outbox_messages_claimedBy_idx" ON "project_outbox_messages" ("claimedBy");
-- Create index "project_outbox_messages_sentAt_deadLetteredAt_nextRetryAt_idx" to table: "project_outbox_messages"
CREATE INDEX "project_outbox_messages_sentAt_deadLetteredAt_nextRetryAt_idx" ON "project_outbox_messages" ("sentAt", "deadLetteredAt", "nextRetryAt");
-- Create enum type "Role"
CREATE TYPE "Role" AS ENUM ('SUPPORTER', 'LEADER');
-- Create enum type "LeaderApplicationStatus"
CREATE TYPE "LeaderApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
-- Create enum type "ApprovalMode"
CREATE TYPE "ApprovalMode" AS ENUM ('AUTO', 'MANUAL');
-- Create enum type "AccountStatus"
CREATE TYPE "AccountStatus" AS ENUM ('PENDING_EMAIL_CONFIRMATION', 'ACTIVE');
-- Create enum type "SupportTicketStatus"
CREATE TYPE "SupportTicketStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');
-- Create "leader_application_outbox_messages" table
CREATE TABLE "leader_application_outbox_messages" (
  "id" text NOT NULL,
  "type" text NOT NULL,
  "payload" jsonb NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" timestamp(3) NULL,
  "attempts" integer NOT NULL DEFAULT 0,
  "lastError" text NULL,
  "nextRetryAt" timestamp(3) NULL,
  "deadLetteredAt" timestamp(3) NULL,
  "claimedAt" timestamp(3) NULL,
  "claimedBy" text NULL,
  PRIMARY KEY ("id")
);
-- Create index "leader_application_outbox_messages_claimedBy_idx" to table: "leader_application_outbox_messages"
CREATE INDEX "leader_application_outbox_messages_claimedBy_idx" ON "leader_application_outbox_messages" ("claimedBy");
-- Create index "leader_application_outbox_messages_sentAt_deadLetteredAt_ne_idx" to table: "leader_application_outbox_messages"
CREATE INDEX "leader_application_outbox_messages_sentAt_deadLetteredAt_ne_idx" ON "leader_application_outbox_messages" ("sentAt", "deadLetteredAt", "nextRetryAt");
-- Create enum type "LeaderApplicationRecruitmentType"
CREATE TYPE "LeaderApplicationRecruitmentType" AS ENUM ('TIME', 'SKILL_ITEM');
-- Create "admin_verification_tokens" table
CREATE TABLE "admin_verification_tokens" (
  "identifier" text NOT NULL,
  "token" text NOT NULL,
  "expires" timestamp(3) NOT NULL
);
-- Create index "admin_verification_tokens_expires_idx" to table: "admin_verification_tokens"
CREATE INDEX "admin_verification_tokens_expires_idx" ON "admin_verification_tokens" ("expires");
-- Create index "admin_verification_tokens_identifier_token_key" to table: "admin_verification_tokens"
CREATE UNIQUE INDEX "admin_verification_tokens_identifier_token_key" ON "admin_verification_tokens" ("identifier", "token");
-- Create index "admin_verification_tokens_token_key" to table: "admin_verification_tokens"
CREATE UNIQUE INDEX "admin_verification_tokens_token_key" ON "admin_verification_tokens" ("token");
-- Create "admin_sessions" table
CREATE TABLE "admin_sessions" (
  "id" text NOT NULL,
  "sessionToken" text NOT NULL,
  "adminAccountId" text NOT NULL,
  "expires" timestamp(3) NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "admin_sessions_adminAccountId_fkey" FOREIGN KEY ("adminAccountId") REFERENCES "admin_accounts" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create index "admin_sessions_adminAccountId_idx" to table: "admin_sessions"
CREATE INDEX "admin_sessions_adminAccountId_idx" ON "admin_sessions" ("adminAccountId");
-- Create index "admin_sessions_expires_idx" to table: "admin_sessions"
CREATE INDEX "admin_sessions_expires_idx" ON "admin_sessions" ("expires");
-- Create index "admin_sessions_sessionToken_key" to table: "admin_sessions"
CREATE UNIQUE INDEX "admin_sessions_sessionToken_key" ON "admin_sessions" ("sessionToken");
-- Create "admin_audit_logs" table
CREATE TABLE "admin_audit_logs" (
  "id" text NOT NULL,
  "adminAccountId" text NOT NULL,
  "adminSessionId" text NULL,
  "action" text NOT NULL,
  "targetType" text NOT NULL,
  "targetId" text NULL,
  "metadata" jsonb NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  CONSTRAINT "admin_audit_logs_adminAccountId_fkey" FOREIGN KEY ("adminAccountId") REFERENCES "admin_accounts" ("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "admin_audit_logs_adminSessionId_fkey" FOREIGN KEY ("adminSessionId") REFERENCES "admin_sessions" ("id") ON UPDATE CASCADE ON DELETE SET NULL
);
-- Create index "admin_audit_logs_action_createdAt_idx" to table: "admin_audit_logs"
CREATE INDEX "admin_audit_logs_action_createdAt_idx" ON "admin_audit_logs" ("action", "createdAt");
-- Create index "admin_audit_logs_adminAccountId_createdAt_idx" to table: "admin_audit_logs"
CREATE INDEX "admin_audit_logs_adminAccountId_createdAt_idx" ON "admin_audit_logs" ("adminAccountId", "createdAt");
-- Create index "admin_audit_logs_adminSessionId_idx" to table: "admin_audit_logs"
CREATE INDEX "admin_audit_logs_adminSessionId_idx" ON "admin_audit_logs" ("adminSessionId");
-- Create index "admin_audit_logs_createdAt_idx" to table: "admin_audit_logs"
CREATE INDEX "admin_audit_logs_createdAt_idx" ON "admin_audit_logs" ("createdAt");
-- Create index "admin_audit_logs_targetType_createdAt_idx" to table: "admin_audit_logs"
CREATE INDEX "admin_audit_logs_targetType_createdAt_idx" ON "admin_audit_logs" ("targetType", "createdAt");
-- Create index "admin_audit_logs_targetType_targetId_idx" to table: "admin_audit_logs"
CREATE INDEX "admin_audit_logs_targetType_targetId_idx" ON "admin_audit_logs" ("targetType", "targetId");
-- Create "accounts" table
CREATE TABLE "accounts" (
  "id" text NOT NULL,
  "email" text NOT NULL,
  "displayName" text NOT NULL,
  "status" "AccountStatus" NOT NULL,
  "passwordHash" text NULL,
  "roles" "Role"[] NULL,
  "activationToken" text NULL,
  "activationTokenExp" timestamp(3) NULL,
  "iconUrl" text NULL,
  "bio" text NULL,
  "snsLinks" jsonb NULL,
  "contributedHours" integer NOT NULL DEFAULT 0,
  "receivedHours" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  "phoneNumber" text NULL,
  PRIMARY KEY ("id")
);
-- Create index "accounts_activationToken_key" to table: "accounts"
CREATE UNIQUE INDEX "accounts_activationToken_key" ON "accounts" ("activationToken");
-- Create index "accounts_email_key" to table: "accounts"
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts" ("email");
-- Create index "accounts_status_idx" to table: "accounts"
CREATE INDEX "accounts_status_idx" ON "accounts" ("status");
-- Create "leader_applications" table
CREATE TABLE "leader_applications" (
  "id" text NOT NULL,
  "accountId" text NOT NULL,
  "status" "LeaderApplicationStatus" NOT NULL,
  "reviewerNote" text NULL,
  "projectTitle" text NOT NULL,
  "projectSummary" text NOT NULL,
  "projectStory" text NOT NULL,
  "projectCategory" text NOT NULL,
  "prefectureCode" text NOT NULL,
  "municipality" text NULL,
  "activityContent" text NULL,
  "snsLinks" jsonb NULL,
  "submittedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" timestamp(3) NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  "reviewedBy" text NULL,
  "phoneNumber" text NULL,
  "progress" "ProjectPhase" NOT NULL DEFAULT 'PLANNING',
  "recruitmentTypes" "LeaderApplicationRecruitmentType"[] NOT NULL DEFAULT '{}',
  "eventLocation" text NULL,
  "eventPeriod" text NULL,
  "recruitCount" integer NULL,
  "skillItemNeeds" text NULL,
  "skillItemDeadline" text NULL,
  "timeReturn" text NULL,
  "skillItemReturn" text NULL,
  "experienceOffered" text NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "leader_applications_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "leader_applications_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "admin_accounts" ("id") ON UPDATE CASCADE ON DELETE RESTRICT
);
-- Create index "leader_applications_accountId_idx" to table: "leader_applications"
CREATE INDEX "leader_applications_accountId_idx" ON "leader_applications" ("accountId");
-- Create index "leader_applications_reviewedBy_idx" to table: "leader_applications"
CREATE INDEX "leader_applications_reviewedBy_idx" ON "leader_applications" ("reviewedBy");
-- Create index "leader_applications_status_idx" to table: "leader_applications"
CREATE INDEX "leader_applications_status_idx" ON "leader_applications" ("status");
-- Create index "leader_applications_submittedAt_idx" to table: "leader_applications"
CREATE INDEX "leader_applications_submittedAt_idx" ON "leader_applications" ("submittedAt");
-- Create "projects" table
CREATE TABLE "projects" (
  "id" text NOT NULL,
  "ownerAccountId" text NOT NULL,
  "slug" text NULL,
  "title" text NOT NULL,
  "summary" text NULL,
  "story" text NULL,
  "leaderIntro" text NULL,
  "coverImageUrl" text NULL,
  "category" text NULL,
  "prefectureCode" text NULL,
  "municipality" text NULL,
  "snsLinks" jsonb NULL,
  "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
  "phase" "ProjectPhase" NOT NULL DEFAULT 'VISION',
  "publishRequestedAt" timestamp(3) NULL,
  "publishedAt" timestamp(3) NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  "activityPlan" text NULL,
  "forcedUnpublishedBy" text NULL,
  "reviewedBy" text NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "projects_forcedUnpublishedBy_fkey" FOREIGN KEY ("forcedUnpublishedBy") REFERENCES "admin_accounts" ("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "projects_ownerAccountId_fkey" FOREIGN KEY ("ownerAccountId") REFERENCES "accounts" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "projects_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "admin_accounts" ("id") ON UPDATE CASCADE ON DELETE RESTRICT
);
-- Create index "projects_category_idx" to table: "projects"
CREATE INDEX "projects_category_idx" ON "projects" ("category");
-- Create index "projects_forcedUnpublishedBy_idx" to table: "projects"
CREATE INDEX "projects_forcedUnpublishedBy_idx" ON "projects" ("forcedUnpublishedBy");
-- Create index "projects_ownerAccountId_idx" to table: "projects"
CREATE INDEX "projects_ownerAccountId_idx" ON "projects" ("ownerAccountId");
-- Create index "projects_prefectureCode_idx" to table: "projects"
CREATE INDEX "projects_prefectureCode_idx" ON "projects" ("prefectureCode");
-- Create index "projects_publishedAt_idx" to table: "projects"
CREATE INDEX "projects_publishedAt_idx" ON "projects" ("publishedAt");
-- Create index "projects_reviewedBy_idx" to table: "projects"
CREATE INDEX "projects_reviewedBy_idx" ON "projects" ("reviewedBy");
-- Create index "projects_slug_key" to table: "projects"
CREATE UNIQUE INDEX "projects_slug_key" ON "projects" ("slug");
-- Create index "projects_status_idx" to table: "projects"
CREATE INDEX "projects_status_idx" ON "projects" ("status");
-- Create "project_review_feedbacks" table
CREATE TABLE "project_review_feedbacks" (
  "id" text NOT NULL,
  "projectId" text NOT NULL,
  "reviewerId" text NOT NULL,
  "action" "ReviewAction" NOT NULL,
  "note" text NULL,
  "reviewedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  CONSTRAINT "project_review_feedbacks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "project_review_feedbacks_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "admin_accounts" ("id") ON UPDATE CASCADE ON DELETE RESTRICT
);
-- Create index "project_review_feedbacks_projectId_idx" to table: "project_review_feedbacks"
CREATE INDEX "project_review_feedbacks_projectId_idx" ON "project_review_feedbacks" ("projectId");
-- Create index "project_review_feedbacks_reviewedAt_idx" to table: "project_review_feedbacks"
CREATE INDEX "project_review_feedbacks_reviewedAt_idx" ON "project_review_feedbacks" ("reviewedAt");
-- Create index "project_review_feedbacks_reviewerId_idx" to table: "project_review_feedbacks"
CREATE INDEX "project_review_feedbacks_reviewerId_idx" ON "project_review_feedbacks" ("reviewerId");
-- Create "support_recruitments" table
CREATE TABLE "support_recruitments" (
  "id" text NOT NULL,
  "projectId" text NOT NULL,
  "type" "RecruitmentType" NOT NULL DEFAULT 'ACTIVITY',
  "title" text NOT NULL,
  "description" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "support_recruitments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create index "support_recruitments_projectId_idx" to table: "support_recruitments"
CREATE INDEX "support_recruitments_projectId_idx" ON "support_recruitments" ("projectId");
-- Create "recruitment_schedules" table
CREATE TABLE "recruitment_schedules" (
  "id" text NOT NULL,
  "supportRecruitmentId" text NOT NULL,
  "date" date NOT NULL,
  "startTime" text NOT NULL,
  "endTime" text NOT NULL,
  "capacityPerHour" integer NOT NULL,
  "approvalMode" "ApprovalMode" NOT NULL DEFAULT 'AUTO',
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "recruitment_schedules_supportRecruitmentId_fkey" FOREIGN KEY ("supportRecruitmentId") REFERENCES "support_recruitments" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create index "recruitment_schedules_date_idx" to table: "recruitment_schedules"
CREATE INDEX "recruitment_schedules_date_idx" ON "recruitment_schedules" ("date");
-- Create index "recruitment_schedules_supportRecruitmentId_date_key" to table: "recruitment_schedules"
CREATE UNIQUE INDEX "recruitment_schedules_supportRecruitmentId_date_key" ON "recruitment_schedules" ("supportRecruitmentId", "date");
-- Create "support_tickets" table
CREATE TABLE "support_tickets" (
  "id" text NOT NULL,
  "recruitmentScheduleId" text NOT NULL,
  "supporterAccountId" text NOT NULL,
  "duration" integer NOT NULL,
  "slotStart" text NOT NULL,
  "companionCount" integer NOT NULL DEFAULT 0,
  "status" "SupportTicketStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "support_tickets_recruitmentScheduleId_fkey" FOREIGN KEY ("recruitmentScheduleId") REFERENCES "recruitment_schedules" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "support_tickets_supporterAccountId_fkey" FOREIGN KEY ("supporterAccountId") REFERENCES "accounts" ("id") ON UPDATE CASCADE ON DELETE RESTRICT
);
-- Create index "support_tickets_recruitmentScheduleId_idx" to table: "support_tickets"
CREATE INDEX "support_tickets_recruitmentScheduleId_idx" ON "support_tickets" ("recruitmentScheduleId");
-- Create index "support_tickets_status_idx" to table: "support_tickets"
CREATE INDEX "support_tickets_status_idx" ON "support_tickets" ("status");
-- Create index "support_tickets_supporterAccountId_idx" to table: "support_tickets"
CREATE INDEX "support_tickets_supporterAccountId_idx" ON "support_tickets" ("supporterAccountId");
