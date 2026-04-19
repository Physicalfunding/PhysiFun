-- AlterTable
ALTER TABLE "leader_application_outbox_messages" ADD COLUMN     "deadLetteredAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "project_outbox_messages" ADD COLUMN     "deadLetteredAt" TIMESTAMP(3);
