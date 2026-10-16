# 開発ルール（詳細版）

> **Note:** Claude 向けの基本ルールは `CLAUDE.md`、コミット / PR 前の検証手順は `.claude/skills/verify-and-pr/SKILL.md` を参照。このファイルは人間向けの詳細ドキュメント。

---

## 開発フロー

### タスク開始時

1. `main` ブランチから開発用ブランチを新規作成してチェックアウト（Claude の場合は `claude/<説明>-<セッションID>`）
2. タスクの内容・影響範囲を確認してから実装開始
3. 既存コードを十分に読んでから変更を加える（推測で書かない）

### タスク完了時

1. 実装が完了したら `.github/workflows/ci.yml` の内容を確認し、CI が通るかローカルで検証する（lint・format・型チェック・テスト・ビルド）。通らない場合は修正する
2. **ユーザーに承認を求める**
3. 承認後: 変更のコミット → push → PR 作成
4. PR には対応する Issue を紐づける
5. CodeRabbit の自動レビューを確認し、指摘事項を修正する
6. 修正があればコミット → push（再レビューが自動で走る） → PRにレビュー内容をコメントで追記

---

## コミットメッセージ例

```
feat: リーダー応募フォームを追加
fix: 画像アップロード時のエラーハンドリングを修正
refactor: ProjectRepository を Kysely 実装に移行
docs: specs/01 に AWS 移行方針を追記
```

---

## コーディング規約

### 命名規則

| 種別 | 規則 | 例 |
|---|---|---|
| コンポーネント | PascalCase | `ProjectCard.tsx` |
| ユースケース | `動詞 + 名詞 + UseCase` | `CreateProjectDraftUseCase.ts` |
| ユースケースの依存 IF | `ユースケース名 + Port`（`ports/` に配置） | `CreateProjectDraftPort.ts` |
| リポジトリ IF（domain） | `名詞 + Repository` | `ProjectRepository.ts` |
| infrastructure 実装 | `Kysely + 名詞 + Adapter / Repository / QueryService` | `KyselyProjectCommandAdapter.ts` |
| API Route | `route.ts` | `app/api/my/projects/route.ts` |
| 型定義ファイル | kebab-case / camelCase | `next-auth.d.ts` |

> 旧 `Prisma*` 実装は Prisma 撤去（Epic #221）まで並存しているが、新規実装は Kysely で書く。

### レイヤーの使い分け

レイヤー別の責務と依存方向は [`docs/specs/01_system-architecture.md`](../specs/01_system-architecture.md) §4 を参照。要点:

- API Route Handler は薄く保ち、ビジネスロジックは UseCase に書く
- UseCase は `Result` 型（`packages/domain/src/shared/result.ts`）で結果を返す
- DB・外部サービスへのアクセスは `packages/infrastructure` に閉じ込める
- UseCase の追加手順は `.claude/skills/add-usecase/SKILL.md` を参照

### DI ヘルパー

- `apps/*/src/lib/di/` のファクトリ関数経由でリクエストごとに生成し、モジュールレベルで `new` しない（モック差し替えを阻害しないため）
- Kysely 実装は ESM 専用のため、サブバレル `@physifun/infrastructure/src/kysely` から import する。Jest テストから読み込まれる DI ファイルには Kysely 実装を持ち込まない

### admin アプリの Server Component 規約（#119 / #131）

- admin ページは `export const dynamic = "force-dynamic"` を必ず宣言する（認証必須 + 常に最新表示のため、ビルド時の静的生成を無効化）。Client Component（`"use client"`）は対象外
- `force-dynamic` 宣言はファイル先頭の import 群の直後にまとめて書く
- `layout.tsx` は state を持たない前提のため宣言しない。動的データ取得を始める場合は page と同様に追加する

### テスト方針

| 対象 | 方式 | 置き場所 |
|---|---|---|
| ドメイン・ユースケース | ユニットテスト（**UseCase には必須**） | 実装の隣の `__tests__/` |
| UI コンポーネント | 重要なものだけ（React Testing Library） | `__tests__/` |
| infrastructure | 実 PostgreSQL に対する統合テスト（Vitest + Testcontainers） | `packages/infrastructure/test/**/*.vitest.ts` |
| 主要フロー | E2E（Playwright） | `tests/e2e/src/specs/` |

CI ではユニットテストを `bun test apps packages` でまとめて実行する。

### コードコメント方針

ユーザー（エンジニア）は TypeScript / React / Next.js / Supabase / Vercel の初学者のため、以下を心がける。

- **役割が分かりにくいオブジェクト・型**には何をするものか簡潔にコメントを残す
- **処理の流れが分かりにくいロジック**には何をしているか簡潔にコメントを残す
- **外部 API を利用する箇所**には参考ドキュメントの URL を記載する

```ts
// 良いコメント例

// Kysely のシングルトン — Next.js のホットリロードで
// 複数のコネクションプールが作られるのを防ぐ
const globalForKysely = globalThis as unknown as { kysely: Kysely<DB> | undefined };

// Supabase Storage に画像をアップロードする
// @see https://supabase.com/docs/guides/storage
const { error } = await supabase.storage.from(bucket).upload(path, file);
```

---

## PR 作成ルール

### PR 本文の構成

```markdown
## 概要
<!-- 何をしたか（1〜3行） -->

## 変更内容
<!-- 変更したファイル・機能の箇条書き -->

## 確認方法
<!-- 動作確認の手順 -->

## 関連 Issue
<!-- Closes #番号 -->
```

---

## 承認フロー

```
実装
  ↓ CI 検証（lint・format・型チェック・テスト・ビルド） → 失敗時は修正
  ↓ PR 作成
  ↓ CodeRabbit 自動レビュー → 指摘修正
  ↓ 人間のレビュー・承認（PR レビュー）
マージ
```

---

## ドキュメント更新タイミング

ドキュメントの全体像は [`docs/README.md`](../README.md) を参照。以下が変わったら、**同じ PR で**該当ファイルを更新する。

| 変更内容 | 更新するファイル |
|---|---|
| プロダクト方針・リリース計画の変更 | `docs/product.md` |
| 技術スタック・インフラ・ディレクトリ構成の変更 | `docs/specs/01_system-architecture.md` |
| ドメインモデル・状態遷移の変更 | `docs/specs/02_domain-model.md` |
| DB スキーマの変更 | `docs/specs/03_data-model.md` |
| 認証・認可・セキュリティ対策の変更 | `docs/specs/04_security-design.md` |
| 主要フロー（応募・公開審査・Magic Link・Outbox）の変更 | `docs/specs/05_key-flows/` |
| 開発フロー・PR ルール・コーディング規約の変更 | `docs/guides/dev-rule.md` |
| 運営アカウント（AdminAccount）のセットアップ・運用手順の変更 | `docs/guides/admin-setup.md` |
| DB 移行（Prisma → Kysely + Atlas）の進捗 | `docs/guides/db-migration.md` |
| Claude 向け基本ルールの変更 | `CLAUDE.md` |
| ローカル開発環境・環境変数の変更 | ルート `README.md` / `apps/web/README.md` / `apps/admin/README.md` |

---

## Vercel Cron 運用メモ

`apps/web/vercel.json` / `apps/admin/vercel.json` の `crons` は Hobby プラン制約で daily (`0 0 * * *`) 設定。Pro 化したら `/api/cron/process-outbox` のメール送信 SLA (30s〜1min) を満たすため `* * * * *` 等の高頻度に切り替えること（#187）。
