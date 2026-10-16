# PhysiFun（フィジファン）

## プロジェクト概要

お金ではなくスキルと時間でプロジェクトを支援するフィジカルファンディングプラットフォーム。
**現在地: 初回リリースに向けて開発中**（リーダー向け: 募集 LP・応募・審査・プロジェクト / サポート募集の準備）。次の段階は「一般公開」（サポーター向け）。詳細と実装状況は `docs/product.md`

---

## 開発ガイドライン

- 思考は英語、出力（会話・ファイル）は **日本語**
- ユーザーの指示に従い、不明点のみ質問して、それ以外は自律的に完遂する
- 既存コードを十分に読んでから変更を加える（推測で書かない）

---

## コマンド

```bash
bun install          # 依存関係インストール
bun dev              # 開発サーバー起動
bun run build        # ビルド
bun run lint         # Lint
bun run typecheck    # 型チェック
```

---

## ブランチ・コミット規約

```
ブランチ: claude/<説明>-<セッションID>
コミット: <種別>: <変更内容の要約>
```

| 種別 | 用途 |
|---|---|
| `feat` | 新機能 |
| `fix` | バグ修正 |
| `refactor` | リファクタ |
| `docs` | ドキュメント |
| `test` | テスト |
| `chore` | 設定・依存関係 |

---

## 禁止事項

- `infrastructure/` 以外で Supabase SDK・DB クライアント（Kysely）を直接呼ばない
- API Route Handler にビジネスロジックを書かない
- `domain/` に外部ライブラリへの依存を持ち込まない
- 不必要なファイル・関数・型を生成しない（過剰な抽象化をしない）

---

## 推奨事項

- 既存コードのパターンに合わせる（一貫性を保つ）
- エラーハンドリングは `Result` 型（`packages/domain/src/shared/result.ts`）を活用
- フォームバリデーションは Zod スキーマで定義
- セキュリティ: SQL インジェクション・XSS・認証バイパスに注意

---

## Skills（Claude 用手順書）

`.claude/skills/` 配下に、繰り返す定型作業の手順を Skill として用意している。
関連作業のときに自動でロードされる（常時読み込みの CLAUDE.md とは別レイヤー）。

| Skill | 用途 |
|---|---|
| `add-usecase` | application 層に UseCase を追加する（`Result` 型・Port DI・併設ユニットテスト必須の規範手順とテンプレート） |
| `verify-and-pr` | コミット / PR 前のローカル検証（CI と一致）と、承認 → push → PR → CodeRabbit フロー |

---

## 開発フロー・PR ルールの詳細

詳細は `docs/guides/dev-rule.md` を参照。

---

## ドキュメント一覧

ドキュメントの地図は **`docs/README.md`**。実装前に読むべきものは以下。

| ファイル | 内容 |
|---|---|
| `docs/product.md` | プロダクト方針・リリース計画・実装状況 |
| `docs/specs/01_system-architecture.md` | 技術スタック・ディレクトリ構成・レイヤー責務（設計の入口） |
| `docs/specs/` | ドメイン・データ・セキュリティ・主要フローの設計仕様 |
| `docs/guides/dev-rule.md` | 開発フロー・PR ルール・コーディング規約 |
| `docs/guides/db-migration.md` | DB 層移行ガイド（Prisma → Kysely + Atlas、クエリ層は移行済み） |

> 用語: リリース段階は「初回リリース」「一般公開」と呼ぶ。古い Issue やコメントにある「Phase 1 / 2 / 3」の読み替えは `docs/product.md` を参照。
