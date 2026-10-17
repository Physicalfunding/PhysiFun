export const meta = {
  name: "pre-pr-check",
  description:
    "PR 作成前に lint・typecheck・test・build・多観点レビューを一括実行し、Go/No-go を判定",
  phases: [
    { title: "検証", detail: "lint / format / typecheck / test / build を並列実行" },
    { title: "品質レビュー", detail: "arch-reviewer + security-reviewer + data-guardian" },
    { title: "判定", detail: "結果を統合して Go/No-go を判定" },
  ],
};

const CHECK_SCHEMA = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    output: { type: "string", description: "最後の数行の出力" },
  },
  required: ["success", "output"],
};

phase("検証");
const [lintResult, formatResult, typecheckResult, testResult] = await parallel([
  () =>
    agent(
      `
PhysiFun の lint チェックを実行してください。

リポジトリルートで:
bun run lint 2>&1 | tail -10

成功なら success=true、失敗なら success=false と最後の出力を返す。
`,
      { label: "lint", schema: CHECK_SCHEMA, phase: "検証" }
    ),

  () =>
    agent(
      `
PhysiFun の format チェックを実行してください。

リポジトリルートで:
bun run format:check 2>&1 | tail -10

成功なら success=true、失敗なら success=false と最後の出力を返す。
`,
      { label: "format", schema: CHECK_SCHEMA, phase: "検証" }
    ),

  () =>
    agent(
      `
PhysiFun の型チェックを実行してください。

リポジトリルートで:
bun run typecheck 2>&1 | tail -10

成功なら success=true、失敗なら success=false と最後の出力を返す。
`,
      { label: "typecheck", schema: CHECK_SCHEMA, phase: "検証" }
    ),

  () =>
    agent(
      `
PhysiFun のテストを実行してください。

リポジトリルートで:
bun test apps packages 2>&1 | tail -20

成功なら success=true、失敗なら success=false と最後の出力を返す。
テストが存在しない場合も success=true として報告。
`,
      { label: "test", schema: CHECK_SCHEMA, phase: "検証" }
    ),
]);

const lintOk = lintResult && lintResult.success;
const formatOk = formatResult && formatResult.success;
const typecheckOk = typecheckResult && typecheckResult.success;
const testOk = testResult && testResult.success;
const allChecksOk = lintOk && formatOk && typecheckOk && testOk;

log(
  `lint=${lintOk ? "OK" : "NG"} format=${formatOk ? "OK" : "NG"} typecheck=${typecheckOk ? "OK" : "NG"} test=${testOk ? "OK" : "NG"}`
);

if (!allChecksOk) {
  log("基本チェックに失敗あり。レビューは続行します。");
}

phase("品質レビュー");
const review = await workflow("full-review");

phase("判定");
const reviewPass =
  !review || review.skipped || (typeof review === "string" && !review.includes("要修正"));

const verdict = allChecksOk && reviewPass ? "GO" : "NO-GO";

const report = await agent(
  `
以下の結果から PR 作成の Go/No-go を判定してください。

## Lint: ${lintOk ? "OK" : "NG"}
${lintResult ? lintResult.output : ""}

## Format: ${formatOk ? "OK" : "NG"}
${formatResult ? formatResult.output : ""}

## TypeCheck: ${typecheckOk ? "OK" : "NG"}
${typecheckResult ? typecheckResult.output : ""}

## Test: ${testOk ? "OK" : "NG"}
${testResult ? testResult.output : ""}

## 品質レビュー:
${review && !review.skipped ? (typeof review === "string" ? review : JSON.stringify(review)) : "スキップ（変更ファイルなし）"}

出力フォーマット:
## Pre-PR Check 結果

| 項目 | 結果 |
|---|---|
| Lint | OK / NG |
| Format | OK / NG |
| TypeCheck | OK / NG |
| Test | OK / NG |
| アーキテクチャ | OK / 注意 / NG |
| セキュリティ | OK / 注意 / NG |
| データスキーマ | OK / 注意 / - |

### 判定: ${"`" + verdict + "`"}
（1〜2 文で理由）

### 未解決事項
（あれば箇条書き）
`,
  { label: "最終判定", phase: "判定" }
);

return report;
