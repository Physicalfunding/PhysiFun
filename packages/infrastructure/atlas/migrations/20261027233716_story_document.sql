-- #315: 本文（projects.story）を、文字から見たまま編集の文書データ（jsonb）に変える。
-- 1. 今ある文字だけの本文を、文書データ（JSON の文字列）に書き換える。ドメインの ProjectStory.fromPlainText と同じ変換:
--    1 行を 1 段落にし、空白だけの行は段落の区切りとして捨てる。空白の文字は JavaScript の trim() と同じものを並べている
--    （[[:space:]] はロケールで変わるため使わない。全角スペースも空白）。
--    同じ結果になることは test/project/StoryDocumentMigration.vitest.ts で確かめている。
--    すでに文書データの行（新しいコードがこのマイグレーションより先に動いて書いたもの）は変えない。
UPDATE "projects" SET "story" = jsonb_build_object(
  'type', 'doc',
  'content', COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object('type', 'paragraph', 'content',
        jsonb_build_array(jsonb_build_object('type', 'text', 'text', "line")))
      ORDER BY "n")
    FROM regexp_split_to_table("story", E'\r\n|\r|\n') WITH ORDINALITY AS "lines"("line", "n")
    WHERE "line" ~ '[^ \t\v\f\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]'
  ), '[]'::jsonb)
)::text
WHERE "story" IS NOT NULL AND "story" NOT LIKE '{"type":"doc"%';
-- 2. 型を jsonb に変える
ALTER TABLE "projects" ALTER COLUMN "story" TYPE jsonb USING "story"::jsonb;
-- Set comment to column: "story" on table: "projects"
COMMENT ON COLUMN "projects"."story" IS '本文（ストーリー）。見たまま編集のエディタの文書データ（JSON）で、許可した要素・装飾・属性だけを持つ。上限（表示される文字の数・画像・動画・大きさ）はドメインの PROJECT_STORY_LIMITS。公開申請に必須（見出し以外の文字か、画像か動画が要る）。ドメインでは body（値オブジェクト ProjectStory）';
