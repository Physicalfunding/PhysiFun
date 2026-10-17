# ドキュメント案内

PhysiFun リポジトリのドキュメントの地図。**迷ったらここから辿る。**

## 正本の考え方

- **コードが最終的な正本**。ドキュメントは構造・意図・手順を伝える地図であり、食い違ったらコードが正
- 1 つの情報は 1 か所にだけ書き、他からはリンクで参照する
- 設計や手順が変わったら**同じ PR で**該当ドキュメントを更新する（対応表は `guides/dev-rule.md` の「ドキュメント更新タイミング」）

## 一覧

| ファイル | 内容 | 読むタイミング |
|---|---|---|
| [`product.md`](./product.md) | プロダクト方針・リリース計画（初回リリース / 一般公開）・実装状況 | スコープを確認したいとき |
| [`specs/`](./specs/README.md) | 設計仕様（システム構成・ドメイン・データ・セキュリティ・主要フロー） | 実装前に構造を把握したいとき |
| [`db/`](./db/README.md) | テーブル定義書・領域別の ER 図（`atlas/schema.sql` から tbls で**自動生成**。手で編集しない） | テーブルや列の意味・関係を調べたいとき |
| [動く ER 図（Liam ERD）](https://physicalfunding.github.io/PhysiFun/) | DB 全体をズーム・検索できる ER 図（`docs/db/schema.json` から自動生成し、GitHub Pages で公開） | 全体を見渡したい・列を検索したいとき |
| [`guides/dev-rule.md`](./guides/dev-rule.md) | 開発フロー・PR ルール・コーディング規約・テスト方針 | 実装・PR を作るとき |
| [`guides/admin-setup.md`](./guides/admin-setup.md) | 運営アカウント（AdminAccount）のセットアップ・運用手順 | 運営メンバーを追加・無効化するとき |
| [`guides/db-migration.md`](./guides/db-migration.md) | DB スキーマ・マイグレーション運用ガイド（Kysely + Atlas）、DB ドキュメントの自動生成（tbls）、残作業 | DB スキーマやクエリを触るとき |
| [`guides/ai-harness.md`](./guides/ai-harness.md) | AI 開発ハーネス設計（実行環境ごとの自律範囲・hooks・段階計画） | Claude の skills / hooks / 設定を触るとき |

### specs の中身

| ファイル | 内容 |
|---|---|
| [`specs/00_terminology.md`](./specs/00_terminology.md) | 用語集（コード上の用語と意図の対訳） |
| [`specs/01_system-architecture.md`](./specs/01_system-architecture.md) | **最初に読む**。インフラ・技術スタック・ディレクトリ構成・レイヤー責務 |
| [`specs/02_domain-model.md`](./specs/02_domain-model.md) | 集約の境界・状態遷移・ルールの置き場所・設計判断・既知のズレ |
| [`specs/03_data-model.md`](./specs/03_data-model.md) | DB 設計の意図（領域・整合性ルール・インデックス・命名） |
| [`specs/04_security-design.md`](./specs/04_security-design.md) | 認証・認可・データ保護・脅威モデル |
| [`specs/05_key-flows/`](./specs/05_key-flows/README.md) | 応募・公開審査・Magic Link・Outbox のシーケンス図 |

## ドキュメント以外の参照先

| 場所 | 内容 |
|---|---|
| ルート [`README.md`](../README.md) | ローカル開発環境のセットアップ・よく使うコマンド |
| [`apps/web/README.md`](../apps/web/README.md) / [`apps/admin/README.md`](../apps/admin/README.md) | アプリ別の役割・環境変数・起動方法 |
| [`CLAUDE.md`](../CLAUDE.md) / `.claude/skills/` | Claude 向けの基本ルールと定型作業の手順 |
| 別リポジトリ `docs-repository` | 業務側のドキュメント（コンセプト・ペルソナ・業務仕様・法務） |
