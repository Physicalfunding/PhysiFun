/**
 * DB ドキュメントサイトに載せるファイルを .content/ に集める（#280）
 *
 * サイトに載せる範囲は「DB 関連だけ」。ここに並べたファイルだけをコピーする（docs/ 全体は載せない）。
 * VitePress はこの .content/ をソースにしてビルドする（.vitepress/config.mts の srcDir）。
 *
 * - docs/db/*.md            … tbls の生成物（テーブル定義書・領域別 ER 図）
 * - docs/specs/02・03       … ドメインモデル・データモデルの設計書
 * - pages/                  … サイト独自のページ（トップページなど）
 * - dist/erd/ → public/er/  … 動く ER 図（Liam ERD）。先に `bun run db:erd` で作っておく。無ければ警告だけ出す
 *
 * 載せる範囲を変えるときは、このファイルと .vitepress/config.mts のメニュー・サイドバーを直す。
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

const siteDir = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(siteDir, "../..");
const contentDir = path.join(siteDir, ".content");

/** サイトに載せる設計書（リポジトリのルートからのパス → サイト内のパス） */
const SPEC_FILES = [
  ["docs/specs/02_domain-model.md", "specs/02_domain-model.md"],
  ["docs/specs/03_data-model.md", "specs/03_data-model.md"],
] as const;

function copy(from: string, to: string): void {
  mkdirSync(path.dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
}

rmSync(contentDir, { recursive: true, force: true });

// サイト独自のページ（トップページなど）
copy(path.join(siteDir, "pages"), contentDir);

// テーブル定義書・領域別 ER 図（Markdown だけ。schema.json はサイトには載せない）
const dbDir = path.join(repoRoot, "docs/db");
for (const file of readdirSync(dbDir)) {
  if (file.endsWith(".md")) copy(path.join(dbDir, file), path.join(contentDir, "db", file));
}

// 設計書
for (const [from, to] of SPEC_FILES) {
  copy(path.join(repoRoot, from), path.join(contentDir, to));
}

// 動く ER 図（Liam ERD）。VitePress の public/ に置くと、そのまま /er/ で配信される
const erdDir = path.join(repoRoot, "dist/erd");
if (existsSync(erdDir)) {
  copy(erdDir, path.join(contentDir, "public/er"));
} else {
  console.warn(
    "[docs-site] dist/erd/ がありません。動く ER 図を含めるには、先に `bun run db:erd` を実行してください"
  );
}

console.log(`[docs-site] ${path.relative(repoRoot, contentDir)}/ にコンテンツを集めました`);
