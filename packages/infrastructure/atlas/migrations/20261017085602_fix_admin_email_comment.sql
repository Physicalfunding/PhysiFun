-- Set comment to column: "email" on table: "admin_accounts"
COMMENT ON COLUMN "admin_accounts"."email" IS 'ログインに使うメールアドレス（小文字・前後の空白なしに正規化。最大 254 文字）';
