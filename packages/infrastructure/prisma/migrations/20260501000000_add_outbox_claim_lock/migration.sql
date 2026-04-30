-- AlterTable: claim/lock 機構を追加 (#187 PR2 review HIGH)
-- 並行実行時の同一メッセージ二重処理を防ぐため、claimedAt + claimedBy(token) で
-- 行単位の排他取得を行う。claim_timeout を超えた古い claim は再 claim 可能。

ALTER TABLE "leader_application_outbox_messages"
  ADD COLUMN "claimedAt" TIMESTAMP(3),
  ADD COLUMN "claimedBy" TEXT;

ALTER TABLE "project_outbox_messages"
  ADD COLUMN "claimedAt" TIMESTAMP(3),
  ADD COLUMN "claimedBy" TEXT;

-- CreateIndex: claim 後の再取得 (claimedBy = token) で利用
CREATE INDEX "leader_application_outbox_messages_claimedBy_idx"
  ON "leader_application_outbox_messages"("claimedBy");

CREATE INDEX "project_outbox_messages_claimedBy_idx"
  ON "project_outbox_messages"("claimedBy");
