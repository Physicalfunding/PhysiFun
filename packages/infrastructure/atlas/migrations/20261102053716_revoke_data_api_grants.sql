-- #360: Supabase の Data API（REST = PostgREST、GraphQL = pg_graphql）から public の表に届かないようにする。
-- Data API は Publishable キー（旧 anon キー）で呼ぶと anon ロールとして動く。表の権限があると、RLS の無い表は誰でも読み書きできる。
-- アプリは DATABASE_URL（postgres ロール。表の所有者）で直接つなぐので、anon / authenticated / service_role の権限は要らない。
-- service_role キーはサーバーで Storage にだけ使う。Storage の表は storage スキーマにあり、public の権限は使わない。
--
-- 1. いまある表・シーケンス・関数から、3 つのロールの権限を外す。
-- 2. postgres がこれから public に作るものにも付かないようにする（Supabase の既定では自動で全権限が付く）。
-- 関数は PostgreSQL の既定で PUBLIC（全ロール）も実行できる（Data API では /rest/v1/rpc/<関数> で呼べる）ので、PUBLIC からも外す。
-- PUBLIC の分はスキーマ単位の既定では外せない（スキーマ単位は全体の既定に足すだけ）ので、postgres が作る関数全体の既定で外す。
--
-- 権限は schema.sql に書けない（Atlas はログインしないと GRANT / REVOKE を扱えない）ので、手書きのマイグレーションにしている。
-- 素の PostgreSQL（CI の postgres:16、Atlas の dev DB）にはこれらのロールが無いので、ロールがあるときだけ実行する。
-- 何度流しても結果は同じ。
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated, service_role;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated, service_role;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
  END IF;
END
$$;
