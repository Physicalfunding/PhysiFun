-- ================================================================
-- Admin 認証を Magic Link 方式に切替 (#145)
--
-- #144 で AdminAccount に追加した password / TOTP 関連カラムを削除し、
-- NextAuth EmailProvider 用の AdminVerificationToken テーブルを新設する。
-- 本番データ未投入のため破壊的 migration で問題なし。
--
-- 冪等性 (#158 M5):
-- - DROP / CREATE はすべて IF (NOT) EXISTS 付き。
-- - 手動リカバリ (途中失敗 -> 再適用) や一部環境のみ先行適用済みといった
--   状況でも安全に再実行できる。
-- ================================================================

-- AdminAccount から認証資格情報カラムを削除
ALTER TABLE "admin_accounts" DROP COLUMN IF EXISTS "passwordHash";
ALTER TABLE "admin_accounts" DROP COLUMN IF EXISTS "totpSecret";
ALTER TABLE "admin_accounts" DROP COLUMN IF EXISTS "totpEnabled";
ALTER TABLE "admin_accounts" DROP COLUMN IF EXISTS "recoveryCodes";

-- AdminVerificationToken テーブル新設 (NextAuth EmailProvider の VerificationToken IF に準拠)
CREATE TABLE IF NOT EXISTS "admin_verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "admin_verification_tokens_token_key" ON "admin_verification_tokens"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "admin_verification_tokens_identifier_token_key" ON "admin_verification_tokens"("identifier", "token");
CREATE INDEX IF NOT EXISTS "admin_verification_tokens_expires_idx" ON "admin_verification_tokens"("expires");
