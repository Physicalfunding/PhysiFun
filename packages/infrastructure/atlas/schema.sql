-- Add new schema named "public"
CREATE SCHEMA IF NOT EXISTS "public";
-- Set comment to schema: "public"
COMMENT ON SCHEMA "public" IS 'standard public schema';
-- Create enum type "AccountStatus"
CREATE TYPE "public"."AccountStatus" AS ENUM ('PENDING_EMAIL_CONFIRMATION', 'ACTIVE');
-- Create enum type "LeaderApplicationStatus"
CREATE TYPE "public"."LeaderApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
-- Create enum type "PublishStatus"
CREATE TYPE "public"."PublishStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED');
-- Create enum type "ProjectPhase"
CREATE TYPE "public"."ProjectPhase" AS ENUM ('VISION', 'PLANNING', 'READY', 'EXECUTION', 'ONGOING');
-- Create enum type "ReviewAction"
CREATE TYPE "public"."ReviewAction" AS ENUM ('APPROVED', 'REJECTED', 'FORCE_UNPUBLISHED');
-- Create enum type "RecruitmentType"
CREATE TYPE "public"."RecruitmentType" AS ENUM ('ACTIVITY');
-- Create enum type "ApprovalMode"
CREATE TYPE "public"."ApprovalMode" AS ENUM ('AUTO', 'MANUAL');
-- Create enum type "SupportTicketStatus"
CREATE TYPE "public"."SupportTicketStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');
-- Create enum type "AdminAccountStatus"
CREATE TYPE "public"."AdminAccountStatus" AS ENUM ('ACTIVE', 'DISABLED');
-- Create enum type "Role"
CREATE TYPE "public"."Role" AS ENUM ('SUPPORTER', 'LEADER');
-- Create enum type "LeaderApplicationRecruitmentType"
CREATE TYPE "public"."LeaderApplicationRecruitmentType" AS ENUM ('TIME', 'SKILL_ITEM');
-- Create "_prisma_migrations" table
CREATE TABLE "public"."_prisma_migrations" (
  "id" character varying(36) NOT NULL,
  "checksum" character varying(64) NOT NULL,
  "finished_at" timestamptz NULL,
  "migration_name" character varying(255) NOT NULL,
  "logs" text NULL,
  "rolled_back_at" timestamptz NULL,
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "applied_steps_count" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("id")
);
-- Create "admin_accounts" table
CREATE TABLE "public"."admin_accounts" (
  "id" text NOT NULL,
  "email" text NOT NULL,
  "status" "public"."AdminAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "lastLoginAt" timestamp(3) NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id")
);
-- Create index "admin_accounts_email_key" to table: "admin_accounts"
CREATE UNIQUE INDEX "admin_accounts_email_key" ON "public"."admin_accounts" ("email");
-- Create index "admin_accounts_status_idx" to table: "admin_accounts"
CREATE INDEX "admin_accounts_status_idx" ON "public"."admin_accounts" ("status");
-- Create "admin_verification_tokens" table
CREATE TABLE "public"."admin_verification_tokens" (
  "identifier" text NOT NULL,
  "token" text NOT NULL,
  "expires" timestamp(3) NOT NULL
);
-- Create index "admin_verification_tokens_expires_idx" to table: "admin_verification_tokens"
CREATE INDEX "admin_verification_tokens_expires_idx" ON "public"."admin_verification_tokens" ("expires");
-- Create index "admin_verification_tokens_identifier_token_key" to table: "admin_verification_tokens"
CREATE UNIQUE INDEX "admin_verification_tokens_identifier_token_key" ON "public"."admin_verification_tokens" ("identifier", "token");
-- Create index "admin_verification_tokens_token_key" to table: "admin_verification_tokens"
CREATE UNIQUE INDEX "admin_verification_tokens_token_key" ON "public"."admin_verification_tokens" ("token");
-- Create "leader_application_outbox_messages" table
CREATE TABLE "public"."leader_application_outbox_messages" (
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
CREATE INDEX "leader_application_outbox_messages_claimedBy_idx" ON "public"."leader_application_outbox_messages" ("claimedBy");
-- Create index "leader_application_outbox_messages_sentAt_deadLetteredAt_ne_idx" to table: "leader_application_outbox_messages"
CREATE INDEX "leader_application_outbox_messages_sentAt_deadLetteredAt_ne_idx" ON "public"."leader_application_outbox_messages" ("sentAt", "deadLetteredAt", "nextRetryAt");
-- Create "project_outbox_messages" table
CREATE TABLE "public"."project_outbox_messages" (
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
CREATE INDEX "project_outbox_messages_claimedBy_idx" ON "public"."project_outbox_messages" ("claimedBy");
-- Create index "project_outbox_messages_sentAt_deadLetteredAt_nextRetryAt_idx" to table: "project_outbox_messages"
CREATE INDEX "project_outbox_messages_sentAt_deadLetteredAt_nextRetryAt_idx" ON "public"."project_outbox_messages" ("sentAt", "deadLetteredAt", "nextRetryAt");
-- Create "admin_sessions" table
CREATE TABLE "public"."admin_sessions" (
  "id" text NOT NULL,
  "sessionToken" text NOT NULL,
  "adminAccountId" text NOT NULL,
  "expires" timestamp(3) NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "admin_sessions_adminAccountId_fkey" FOREIGN KEY ("adminAccountId") REFERENCES "public"."admin_accounts" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create index "admin_sessions_adminAccountId_idx" to table: "admin_sessions"
CREATE INDEX "admin_sessions_adminAccountId_idx" ON "public"."admin_sessions" ("adminAccountId");
-- Create index "admin_sessions_expires_idx" to table: "admin_sessions"
CREATE INDEX "admin_sessions_expires_idx" ON "public"."admin_sessions" ("expires");
-- Create index "admin_sessions_sessionToken_key" to table: "admin_sessions"
CREATE UNIQUE INDEX "admin_sessions_sessionToken_key" ON "public"."admin_sessions" ("sessionToken");
-- Create "admin_audit_logs" table
CREATE TABLE "public"."admin_audit_logs" (
  "id" text NOT NULL,
  "adminAccountId" text NOT NULL,
  "adminSessionId" text NULL,
  "action" text NOT NULL,
  "targetType" text NOT NULL,
  "targetId" text NULL,
  "metadata" jsonb NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  CONSTRAINT "admin_audit_logs_adminAccountId_fkey" FOREIGN KEY ("adminAccountId") REFERENCES "public"."admin_accounts" ("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "admin_audit_logs_adminSessionId_fkey" FOREIGN KEY ("adminSessionId") REFERENCES "public"."admin_sessions" ("id") ON UPDATE CASCADE ON DELETE SET NULL
);
-- Create index "admin_audit_logs_action_createdAt_idx" to table: "admin_audit_logs"
CREATE INDEX "admin_audit_logs_action_createdAt_idx" ON "public"."admin_audit_logs" ("action", "createdAt");
-- Create index "admin_audit_logs_adminAccountId_createdAt_idx" to table: "admin_audit_logs"
CREATE INDEX "admin_audit_logs_adminAccountId_createdAt_idx" ON "public"."admin_audit_logs" ("adminAccountId", "createdAt");
-- Create index "admin_audit_logs_adminSessionId_idx" to table: "admin_audit_logs"
CREATE INDEX "admin_audit_logs_adminSessionId_idx" ON "public"."admin_audit_logs" ("adminSessionId");
-- Create index "admin_audit_logs_createdAt_idx" to table: "admin_audit_logs"
CREATE INDEX "admin_audit_logs_createdAt_idx" ON "public"."admin_audit_logs" ("createdAt");
-- Create index "admin_audit_logs_targetType_createdAt_idx" to table: "admin_audit_logs"
CREATE INDEX "admin_audit_logs_targetType_createdAt_idx" ON "public"."admin_audit_logs" ("targetType", "createdAt");
-- Create index "admin_audit_logs_targetType_targetId_idx" to table: "admin_audit_logs"
CREATE INDEX "admin_audit_logs_targetType_targetId_idx" ON "public"."admin_audit_logs" ("targetType", "targetId");
-- Create "accounts" table
CREATE TABLE "public"."accounts" (
  "id" text NOT NULL,
  "email" text NOT NULL,
  "displayName" text NOT NULL,
  "status" "public"."AccountStatus" NOT NULL,
  "passwordHash" text NULL,
  "roles" "public"."Role"[] NULL,
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
CREATE UNIQUE INDEX "accounts_activationToken_key" ON "public"."accounts" ("activationToken");
-- Create index "accounts_email_key" to table: "accounts"
CREATE UNIQUE INDEX "accounts_email_key" ON "public"."accounts" ("email");
-- Create index "accounts_status_idx" to table: "accounts"
CREATE INDEX "accounts_status_idx" ON "public"."accounts" ("status");
-- Create "leader_applications" table
CREATE TABLE "public"."leader_applications" (
  "id" text NOT NULL,
  "accountId" text NOT NULL,
  "status" "public"."LeaderApplicationStatus" NOT NULL,
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
  "progress" "public"."ProjectPhase" NOT NULL DEFAULT 'PLANNING',
  "recruitmentTypes" "public"."LeaderApplicationRecruitmentType"[] NOT NULL DEFAULT '{}',
  "eventLocation" text NULL,
  "eventPeriod" text NULL,
  "recruitCount" integer NULL,
  "skillItemNeeds" text NULL,
  "skillItemDeadline" text NULL,
  "timeReturn" text NULL,
  "skillItemReturn" text NULL,
  "experienceOffered" text NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "leader_applications_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."accounts" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "leader_applications_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "public"."admin_accounts" ("id") ON UPDATE CASCADE ON DELETE RESTRICT
);
-- Create index "leader_applications_accountId_idx" to table: "leader_applications"
CREATE INDEX "leader_applications_accountId_idx" ON "public"."leader_applications" ("accountId");
-- Create index "leader_applications_reviewedBy_idx" to table: "leader_applications"
CREATE INDEX "leader_applications_reviewedBy_idx" ON "public"."leader_applications" ("reviewedBy");
-- Create index "leader_applications_status_idx" to table: "leader_applications"
CREATE INDEX "leader_applications_status_idx" ON "public"."leader_applications" ("status");
-- Create index "leader_applications_submittedAt_idx" to table: "leader_applications"
CREATE INDEX "leader_applications_submittedAt_idx" ON "public"."leader_applications" ("submittedAt");
-- Create "projects" table
CREATE TABLE "public"."projects" (
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
  "status" "public"."PublishStatus" NOT NULL DEFAULT 'DRAFT',
  "phase" "public"."ProjectPhase" NOT NULL DEFAULT 'VISION',
  "publishRequestedAt" timestamp(3) NULL,
  "publishedAt" timestamp(3) NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  "activityPlan" text NULL,
  "forcedUnpublishedBy" text NULL,
  "reviewedBy" text NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "projects_forcedUnpublishedBy_fkey" FOREIGN KEY ("forcedUnpublishedBy") REFERENCES "public"."admin_accounts" ("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "projects_ownerAccountId_fkey" FOREIGN KEY ("ownerAccountId") REFERENCES "public"."accounts" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "projects_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "public"."admin_accounts" ("id") ON UPDATE CASCADE ON DELETE RESTRICT
);
-- Create index "projects_category_idx" to table: "projects"
CREATE INDEX "projects_category_idx" ON "public"."projects" ("category");
-- Create index "projects_forcedUnpublishedBy_idx" to table: "projects"
CREATE INDEX "projects_forcedUnpublishedBy_idx" ON "public"."projects" ("forcedUnpublishedBy");
-- Create index "projects_ownerAccountId_idx" to table: "projects"
CREATE INDEX "projects_ownerAccountId_idx" ON "public"."projects" ("ownerAccountId");
-- Create index "projects_prefectureCode_idx" to table: "projects"
CREATE INDEX "projects_prefectureCode_idx" ON "public"."projects" ("prefectureCode");
-- Create index "projects_publishedAt_idx" to table: "projects"
CREATE INDEX "projects_publishedAt_idx" ON "public"."projects" ("publishedAt");
-- Create index "projects_reviewedBy_idx" to table: "projects"
CREATE INDEX "projects_reviewedBy_idx" ON "public"."projects" ("reviewedBy");
-- Create index "projects_slug_key" to table: "projects"
CREATE UNIQUE INDEX "projects_slug_key" ON "public"."projects" ("slug");
-- Create index "projects_status_idx" to table: "projects"
CREATE INDEX "projects_status_idx" ON "public"."projects" ("status");
-- Create "project_review_feedbacks" table
CREATE TABLE "public"."project_review_feedbacks" (
  "id" text NOT NULL,
  "projectId" text NOT NULL,
  "reviewerId" text NOT NULL,
  "action" "public"."ReviewAction" NOT NULL,
  "note" text NULL,
  "reviewedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  CONSTRAINT "project_review_feedbacks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "project_review_feedbacks_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "public"."admin_accounts" ("id") ON UPDATE CASCADE ON DELETE RESTRICT
);
-- Create index "project_review_feedbacks_projectId_idx" to table: "project_review_feedbacks"
CREATE INDEX "project_review_feedbacks_projectId_idx" ON "public"."project_review_feedbacks" ("projectId");
-- Create index "project_review_feedbacks_reviewedAt_idx" to table: "project_review_feedbacks"
CREATE INDEX "project_review_feedbacks_reviewedAt_idx" ON "public"."project_review_feedbacks" ("reviewedAt");
-- Create index "project_review_feedbacks_reviewerId_idx" to table: "project_review_feedbacks"
CREATE INDEX "project_review_feedbacks_reviewerId_idx" ON "public"."project_review_feedbacks" ("reviewerId");
-- Create "support_recruitments" table
CREATE TABLE "public"."support_recruitments" (
  "id" text NOT NULL,
  "projectId" text NOT NULL,
  "type" "public"."RecruitmentType" NOT NULL DEFAULT 'ACTIVITY',
  "title" text NOT NULL,
  "description" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "support_recruitments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create index "support_recruitments_projectId_idx" to table: "support_recruitments"
CREATE INDEX "support_recruitments_projectId_idx" ON "public"."support_recruitments" ("projectId");
-- Create "recruitment_schedules" table
CREATE TABLE "public"."recruitment_schedules" (
  "id" text NOT NULL,
  "supportRecruitmentId" text NOT NULL,
  "date" date NOT NULL,
  "startTime" text NOT NULL,
  "endTime" text NOT NULL,
  "capacityPerHour" integer NOT NULL,
  "approvalMode" "public"."ApprovalMode" NOT NULL DEFAULT 'AUTO',
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "recruitment_schedules_supportRecruitmentId_fkey" FOREIGN KEY ("supportRecruitmentId") REFERENCES "public"."support_recruitments" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);
-- Create index "recruitment_schedules_date_idx" to table: "recruitment_schedules"
CREATE INDEX "recruitment_schedules_date_idx" ON "public"."recruitment_schedules" ("date");
-- Create index "recruitment_schedules_supportRecruitmentId_date_key" to table: "recruitment_schedules"
CREATE UNIQUE INDEX "recruitment_schedules_supportRecruitmentId_date_key" ON "public"."recruitment_schedules" ("supportRecruitmentId", "date");
-- Create "support_tickets" table
CREATE TABLE "public"."support_tickets" (
  "id" text NOT NULL,
  "recruitmentScheduleId" text NOT NULL,
  "supporterAccountId" text NOT NULL,
  "duration" integer NOT NULL,
  "slotStart" text NOT NULL,
  "companionCount" integer NOT NULL DEFAULT 0,
  "status" "public"."SupportTicketStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "support_tickets_recruitmentScheduleId_fkey" FOREIGN KEY ("recruitmentScheduleId") REFERENCES "public"."recruitment_schedules" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "support_tickets_supporterAccountId_fkey" FOREIGN KEY ("supporterAccountId") REFERENCES "public"."accounts" ("id") ON UPDATE CASCADE ON DELETE RESTRICT
);
-- Create index "support_tickets_recruitmentScheduleId_idx" to table: "support_tickets"
CREATE INDEX "support_tickets_recruitmentScheduleId_idx" ON "public"."support_tickets" ("recruitmentScheduleId");
-- Create index "support_tickets_status_idx" to table: "support_tickets"
CREATE INDEX "support_tickets_status_idx" ON "public"."support_tickets" ("status");
-- Create index "support_tickets_supporterAccountId_idx" to table: "support_tickets"
CREATE INDEX "support_tickets_supporterAccountId_idx" ON "public"."support_tickets" ("supporterAccountId");
