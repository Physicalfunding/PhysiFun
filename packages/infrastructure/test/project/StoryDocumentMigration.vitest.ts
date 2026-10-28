import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { sql } from "kysely";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ProjectStory } from "@physifun/domain";
import { db } from "../../src/database/kysely/client";

/**
 * 本文を文書データに変えるマイグレーション（`20261027233716_story_document.sql`、#315）の integration test
 *
 * 1 つ前の版まで適用した DB に文字だけの本文を入れ、このマイグレーションのあとで、
 * ドメインの `ProjectStory.fromPlainText` と同じ文書データになることを確かめる。
 * ほかのテストと DB を分けるため、同じ PostgreSQL の中に使い捨てのデータベースを作る
 * （`INFRA_TEST_DATABASE_URL` を使うときは、そのユーザーに CREATEDB の権限が要る）。
 */
// projects を変えるマイグレーションをこの前に足したときは、BEFORE_VERSION と INSERT を見直す
const BEFORE_VERSION = "20261017085602";
const DATABASE = "story_migration_test";

/** JavaScript の trim() が空白とみなす文字（全角スペースなど）。この文字だけの行は捨てられる */
const WHITESPACE = [
  0x09, 0x0b, 0x0c, 0x20, 0xa0, 0x1680, 0x2000, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000,
  0xfeff,
].map((code) => String.fromCharCode(code));

const STORIES: Record<string, string> = {
  lines: "1行目\n\n2行目\r\n3行目\r4行目",
  whitespaceLines: ["前の行", ...WHITESPACE, WHITESPACE.join(""), "後の行"].join("\n"),
  specialChars: '"引用" と \\ と <script>alert(1)</script>',
  blankOnly: "\n\n",
  // 文書データに見える文字も、ただの文字として段落にする（検査を通っていない文書を入れないため）
  jsonLike:
    '{"type":"doc","content":[{"type":"image","attrs":{"src":"https://evil.example.com/a.png"}}]}',
};

describe("本文を文書データに変えるマイグレーション（#315）", () => {
  let url: URL;
  let client: Client | undefined;

  beforeAll(async () => {
    const base = process.env.DATABASE_URL;
    if (!base) throw new Error("DATABASE_URL is not set");
    url = new URL(base);
    url.pathname = `/${DATABASE}`;

    await sql`DROP DATABASE IF EXISTS ${sql.id(DATABASE)} WITH (FORCE)`.execute(db);
    await sql`CREATE DATABASE ${sql.id(DATABASE)}`.execute(db);
    migrate(url, BEFORE_VERSION);
    client = new Client({ connectionString: url.toString() });
    await client.connect();
  });

  afterAll(async () => {
    await client?.end();
    await sql`DROP DATABASE IF EXISTS ${sql.id(DATABASE)} WITH (FORCE)`.execute(db);
    await db.destroy();
  });

  it("文字だけの本文が fromPlainText と同じ文書データになり、NULL は NULL のまま", async () => {
    if (!client) throw new Error("client is not connected");
    const ownerId = randomUUID();
    await client.query(
      `INSERT INTO accounts (id, email, "displayName", status, "updatedAt") VALUES ($1, $2, $3, 'ACTIVE', now())`,
      [ownerId, "story-migration@example.com", "移行テスト"]
    );
    for (const [title, story] of [...Object.entries(STORIES), ["null", null]]) {
      await client.query(
        `INSERT INTO projects (id, "ownerAccountId", title, story, "updatedAt") VALUES ($1, $2, $3, $4, now())`,
        [randomUUID(), ownerId, title, story]
      );
    }

    migrate(url);

    const migrated = await client.query<{ title: string; story: unknown }>(
      `SELECT title, story FROM projects`
    );
    const stories = Object.fromEntries(migrated.rows.map((row) => [row.title, row.story]));
    for (const [title, text] of Object.entries(STORIES)) {
      expect(stories[title], title).toEqual(fromPlainText(text));
    }
    expect(stories.null).toBeNull();
    // 期待する形も 1 つは書いておく（fromPlainText の変更で両方が一緒にずれても気づけるように）
    expect(stories.lines).toEqual({
      type: "doc",
      content: ["1行目", "2行目", "3行目", "4行目"].map((text) => ({
        type: "paragraph",
        content: [{ type: "text", text }],
      })),
    });
  });
});

/** atlas migrate apply（globalSetup と同じく env "local" を使い、適用先だけ差し替える） */
function migrate(target: URL, toVersion?: string): void {
  const atlasUrl = new URL(target);
  if (!atlasUrl.searchParams.has("sslmode")) atlasUrl.searchParams.set("sslmode", "disable");
  execSync(`atlas migrate apply --env local${toVersion ? ` --to-version ${toVersion}` : ""}`, {
    cwd: fileURLToPath(new URL("../..", import.meta.url)),
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: atlasUrl.toString() },
  });
}

function fromPlainText(text: string) {
  const story = ProjectStory.fromPlainText(text);
  if (!story.ok) throw new Error(`fromPlainText failed: ${JSON.stringify(story.error)}`);
  return story.value.toJSON();
}
