-- DropIndex
DROP INDEX IF EXISTS "leader_application_outbox_messages_sentAt_nextRetryAt_idx";
DROP INDEX IF EXISTS "project_outbox_messages_sentAt_nextRetryAt_idx";

-- CreateIndex
CREATE INDEX "leader_application_outbox_messages_sentAt_deadLetteredAt_nextRetryAt_idx" ON "leader_application_outbox_messages"("sentAt", "deadLetteredAt", "nextRetryAt");
CREATE INDEX "project_outbox_messages_sentAt_deadLetteredAt_nextRetryAt_idx" ON "project_outbox_messages"("sentAt", "deadLetteredAt", "nextRetryAt");
