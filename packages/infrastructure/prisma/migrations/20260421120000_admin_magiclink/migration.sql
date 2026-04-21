-- ================================================================
-- Admin 認証を Magic Link 方式に切替 (#145)
--
-- #144 で AdminAccount に追加した password / TOTP 関連カラムを削除し、
-- NextAuth EmailProvider 用の AdminVerificationToken テーブルを新設する。
-- 本番データ未投入のため破壊的 migration で問題なし。
-- ================================================================

-- AdminAccount から認証資格情報カラムを削除
ALTER TABLE "admin_accounts" DROP COLUMN "passwordHash";
ALTER TABLE "admin_accounts" DROP COLUMN "totpSecret";
ALTER TABLE "admin_accounts" DROP COLUMN "totpEnabled";
ALTER TABLE "admin_accounts" DROP COLUMN "recoveryCodes";

-- AdminVerificationToken テーブル新設 (NextAuth EmailProvider の VerificationToken IF に準拠)
CREATE TABLE "admin_verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "admin_verification_tokens_token_key" ON "admin_verification_tokens"("token");
CREATE UNIQUE INDEX "admin_verification_tokens_identifier_token_key" ON "admin_verification_tokens"("identifier", "token");
CREATE INDEX "admin_verification_tokens_expires_idx" ON "admin_verification_tokens"("expires");
