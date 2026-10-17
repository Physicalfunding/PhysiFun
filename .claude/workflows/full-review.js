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
      description: "Atlas schema.sql / atlas/migrations / Kysely 型（types.ts）の変更があるか",
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
2. .ts / .tsx ファイルに絞る（+ atlas/schema.sql と atlas/migrations/*.sql も対象）
3. 分類:
   - appFiles: apps/ 配下と packages/server-shared/ 配下（サーバー側の共通コード）
   - domainFiles: packages/domain/ 配下
   - applicationFiles: packages/application/ 配下
   - infraFiles: packages/infrastructure/ 配下
   - hasSchemaChanges: atlas/schema.sql / atlas/migrations / src/database/kysely/types.ts の変更があるか
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
\`.claude/agents/arch-reviewer.md\` を読み、その指示（最初にやること・検査項目・出力フォーマット）に従って、次のファイルをレビューしてください。コードは修正しないでください。

## 対象ファイル
${files.allFiles.join("\n")}
`,
      { label: "arch-reviewer", phase: "並列レビュー" }
    )
  );
}

if (files.appFiles.length > 0 || files.infraFiles.length > 0) {
  tasks.push(() =>
    agent(
      `
\`.claude/agents/security-reviewer.md\` を読み、その指示（最初にやること・検査項目・出力フォーマット）に従って、次のファイルをレビューしてください。コードは修正しないでください。

## 対象ファイル
${[...files.appFiles, ...files.infraFiles].join("\n")}
`,
      { label: "security-reviewer", phase: "並列レビュー" }
    )
  );
}

if (files.hasSchemaChanges || files.infraFiles.length > 0) {
  tasks.push(() =>
    agent(
      `
\`.claude/agents/data-guardian.md\` を読み、その指示（最初にやること・検査項目・出力フォーマット）に従って、次のファイルをレビューしてください。コードは修正しないでください。

## 対象ファイル
${files.infraFiles.join("\n")}
${files.hasSchemaChanges ? "（スキーマ変更あり。git diff で変更内容も確認すること）" : ""}
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
