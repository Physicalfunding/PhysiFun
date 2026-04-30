-- AddColumn: Account.phoneNumber を追加 (Issue #192 / PR 2)
-- 任意項目。〜20 文字、ハイフン込み・国際表記許容（フォーマット制約は app 層で実施）。

ALTER TABLE "accounts" ADD COLUMN "phoneNumber" TEXT;
