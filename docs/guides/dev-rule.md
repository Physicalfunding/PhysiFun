# 開発ルール（詳細版）

> **Note:** 基本ルールは `CLAUDE.md` を参照。このファイルは人間向けの詳細ドキュメント。

---

## 開発フロー

### タスク開始時

1. `main` ブランチから開発用ブランチを新規作成してチェックアウト
2. タスクの内容・影響範囲を確認してから実装開始
3. 既存コードを十分に読んでから変更を加える（推測で書かない）

### タスク完了時

1. 実装が完了したら `.github/workflows/ci.yml` の内容を確認し、CI が通るかローカルで検証する（lint・型チェック・ビルド等）。通らない場合は修正する
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
refactor: ProjectRepository を Prisma 実装に移行
docs: tech.md にAWS移行方針を追記
```

---

## PR 作成ルール

ユーザー（エンジニア）は TypeScript / React / Next.js / Supabase / Vercel の初学者のため、以下を心がける。

### コードコメント方針

- **役割が分かりにくいオブジェクト・型**には何をするものか簡潔にコメントを残す
- **処理の流れが分かりにくいロジック**には何をしているか簡潔にコメントを残す
- **外部 API を利用する箇所**には参考ドキュメントの URL を記載する

```ts
// 良いコメント例

// Prisma Client のシングルトン — Next.js のホットリロードで
// 複数インスタンスが作られるのを防ぐ
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

// Supabase Storage に画像をアップロードする
// @see https://supabase.com/docs/guides/storage
const { error } = await supabase.storage.from(bucket).upload(path, file);
```

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
  ↓ CI 検証（lint・型チェック・ビルド等） → 失敗時は修正
  ↓ PR 作成
  ↓ CodeRabbit 自動レビュー → 指摘修正
  ↓ 人間のレビュー・承認（PR レビュー）
マージ
```

---

## ドキュメント更新タイミング

以下の決定が変わったら、該当するファイルを更新する。

| 変更内容 | 更新するファイル |
|---|---|
| プロダクト方針・フェーズ計画の変更 | `product.md` |
| 技術スタック・インフラの変更 | `tech.md` |
| ディレクトリ構成・命名規則の変更 | `structure.md` |
| 開発フロー・PR ルールの変更 | `dev-rule.md` |
| Claude 向け基本ルールの変更 | `CLAUDE.md` |
| 運営アカウント（AdminAccount）のセットアップ・運用手順の変更 | `admin-role-setup.md` |
| ローカル開発環境のセットアップ手順の変更 | ルート `README.md` / `apps/web/README.md` / `apps/admin/README.md` |

---

## Vercel Cron 運用メモ

`apps/web/vercel.json` / `apps/admin/vercel.json` の `crons` は Hobby プラン制約で daily (`0 0 * * *`) 設定。Pro 化したら `/api/cron/process-outbox` のメール送信 SLA (30s〜1min) を満たすため `* * * * *` 等の高頻度に切り替えること（#187）。
