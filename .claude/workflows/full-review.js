export const meta = {
  name: "full-review",
  description:
    "変更ファイルに対して arch-reviewer + security-reviewer + data-guardian を並列実行し、結果を統合報告",
  phases: [
    { title: "変更分析", detail: "変更ファイルを検出・分類" },
    { title: "並列レビュー", detail: "アーキテクチャ・セキュリティ・データの観点で並列レビュー" },
    { title: "統合", detail: "レビュー結果を統合して報告" },
  ],
};

const FILE_SCHEMA = {
  type: "object",
  properties: {
    appFiles: {
      type: "array",
      items: { type: "string" },
      description: "apps/ 配下の変更ファイル（Route Handler, ページ, コンポーネント）",
    },
    domainFiles: {
      type: "array",
      items: { type: "string" },
      description: "packages/domain/ 配下の変更ファイル",
    },
    applicationFiles: {
      type: "array",
      items: { type: "string" },
      description: "packages/application/ 配下の変更ファイル",
    },
    infraFiles: {
      type: "array",
      items: { type: "string" },
      description: "packages/infrastructure/ 配下の変更ファイル",
    },
    hasSchemaChanges: {
      type: "boolean",
      description: "Prisma スキーマ / Kysely 型定義 / Atlas schema.sql の変更があるか",
    },
    allFiles: {
      type: "array",
      items: { type: "string" },
      description: "変更された全 .ts/.tsx ファイル",
    },
  },
  required: [
    "appFiles",
    "domainFiles",
    "applicationFiles",
    "infraFiles",
    "hasSchemaChanges",
    "allFiles",
  ],
};

phase("変更分析");
const files = await agent(
  `
変更された TypeScript ファイルを検出・分類してください。

手順:
1. git diff --name-only main...HEAD で変更ファイルを取得
   - main と同じコミットなら git diff --name-only HEAD~1 を使う
   - それでもなければ git status --short で変更を確認
2. .ts / .tsx ファイルに絞る（+ schema.prisma, types.ts, schema.sql も対象）
3. 分類:
   - appFiles: apps/ 配下
   - domainFiles: packages/domain/ 配下
   - applicationFiles: packages/application/ 配下
   - infraFiles: packages/infrastructure/ 配下
   - hasSchemaChanges: schema.prisma / types.ts（kysely）/ schema.sql の変更があるか
   - allFiles: 全 .ts/.tsx ファイル
`,
  { label: "ファイル分類", schema: FILE_SCHEMA }
);

if (!files || files.allFiles.length === 0) {
  log("変更された TypeScript ファイルなし。スキップします。");
  return { skipped: true };
}

log(
  `apps=${files.appFiles.length} domain=${files.domainFiles.length} app=${files.applicationFiles.length} infra=${files.infraFiles.length} schema=${files.hasSchemaChanges}`
);

phase("並列レビュー");
const tasks = [];

if (files.allFiles.length > 0) {
  tasks.push(() =>
    agent(
      `
PhysiFun のアーキテクチャ境界レビューを行ってください。

## 対象ファイル
${files.allFiles.join("\n")}

## 手順
1. CLAUDE.md を読む（禁止事項・推奨事項）
2. .docs/structure.md を読む（レイヤー別責務・命名規則）
3. 対象ファイルを読む
4. 以下を検査:
   A. レイヤー境界違反: infrastructure/ 以外での Supabase/Kysely/Prisma import、domain/ での外部ライブラリ依存
   B. UseCase パターン: Result 型、判別共用体エラー、Port DI
   C. 命名規則: UseCase/Port/Repository の命名
   D. API Route Handler: 薄い BFF になっているか
   E. 依存方向: Presentation → Application → Domain ← Infrastructure

ファイルごとに「違反 / 注意 / OK」を報告。違反は行番号付きで。
`,
      { label: "arch-reviewer", phase: "並列レビュー" }
    )
  );
}

if (files.appFiles.length > 0 || files.infraFiles.length > 0) {
  tasks.push(() =>
    agent(
      `
PhysiFun のセキュリティレビューを行ってください。

## 対象ファイル
${[...files.appFiles, ...files.infraFiles].join("\n")}

## 手順
1. .docs/tech.md を読む（認証方式・環境変数）
2. 対象ファイルを読む
3. 以下を検査:
   A. SQL インジェクション: Kysely sql タグ、Prisma $queryRaw のパラメータバインド
   B. XSS: dangerouslySetInnerHTML、ユーザー入力の URL 埋め込み
   C. 認証・認可: getServerSession 呼び出し漏れ、ロールチェック、IDOR
   D. 機密情報: NEXT_PUBLIC 以外の環境変数露出、API レスポンスの内部情報
   E. 入力バリデーション: Zod 検証、ファイルアップロード制限

リスクレベル（高/中/低）と対処法を報告。
`,
      { label: "security-reviewer", phase: "並列レビュー" }
    )
  );
}

if (files.hasSchemaChanges || files.infraFiles.length > 0) {
  tasks.push(() =>
    agent(
      `
PhysiFun の DB スキーマ安全チェックを行ってください。

## 対象ファイル
${files.infraFiles.join("\n")}
${files.hasSchemaChanges ? "（スキーマ変更あり）" : ""}

## 手順
1. packages/infrastructure/prisma/schema.prisma を読む
2. packages/infrastructure/src/database/kysely/types.ts を読む
3. .docs/db-migration-kysely-atlas.md を読む
4. git diff で変更内容を確認
5. 以下を検査:
   A. Prisma スキーマ互換性: カラム追加時の @default、型変更、カスケード削除
   B. Kysely 型定義との整合: camelCase 一致、NULL 許容、INSERT 省略可能
   C. Atlas schema.sql との整合
   D. Repository / QueryService への波及
   E. ドメイン層への波及

リスクレベル（高/中/低）と推奨アクションを報告。
`,
      { label: "data-guardian", phase: "並列レビュー" }
    )
  );
}

if (tasks.length === 0) {
  log("レビュー対象なし。");
  return { skipped: true };
}

const reviews = await parallel(tasks);

phase("統合");
const valid = reviews.filter(Boolean);
const report = await agent(
  `
以下のレビュー結果を統合し、優先度順に整理してください。

${valid.map((r, i) => `--- レビュー ${i + 1} ---\n${r}`).join("\n\n")}

出力フォーマット:
## Full Review 結果

### 要修正
（違反があれば優先度順にリスト。なければ「なし」）

### 注意
（懸念があればリスト。なければ「なし」）

### 総評
（1〜2 文。全体の品質判定）

### 判定: PASS / 要修正
`,
  { label: "統合レポート", phase: "統合" }
);

return report;
