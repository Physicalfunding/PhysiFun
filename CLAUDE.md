# Physical Founding

## プロジェクト概要

お金ではなくスキルと時間でプロジェクトを支援するフィジカルファンディングプラットフォーム。
**現在のフェーズ: Phase 1 準備中**（リーダー募集 LP + 応募フォーム + リーダー機能。旧 Phase 1 + 旧 Phase 2 を統合した新 2 フェーズ構成。詳細は `.docs/product.md`）

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
- エラーハンドリングは `Result` 型（`src/domain/shared/result.ts`）を活用
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

詳細は `.docs/dev-rule.md` を参照。

---

## ドキュメント一覧

| ファイル | 内容 |
|---|---|
| `.docs/product.md` | プロダクト方針・フェーズ計画 |
| `.docs/tech.md` | 技術スタック・インフラ |
| `.docs/structure.md` | ディレクトリ構成・命名規則 |
| `.docs/dev-rule.md` | 開発フロー・PR ルール |
| `.docs/requirements.md` | 要件定義 |
| `.docs/design.md` | 設計書 |
| `.docs/db-migration-kysely-atlas.md` | DB 層移行ガイド（Prisma → Kysely + Atlas、PoC: project ドメイン移行済み） |
