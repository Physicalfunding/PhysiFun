# @physifun/application

PhysiFun のアプリケーション層（UseCase）。トランザクション境界・状態遷移・Outbox 書き込みをここで調停する。

## スコープ

- `use-cases/auth/`
- `use-cases/leader-application/` — 応募送信・承認・却下
- `use-cases/project/` — 作成・編集・公開申請・審査
- `use-cases/recruitment/` — サポート募集（Phase 1: リーダー側 UI のみ）

## 依存方針

- `@physifun/domain` の Entity / Repository インターフェースに依存する
- `@physifun/infrastructure` の実装クラスには依存しない（DI で受け取る）
- Next.js / Prisma / Supabase SDK を直接参照しない

詳細は `PhysiFun/.docs/structure.md` と各ドメインドキュメントを参照。

## 利用上の注意

- `package.json` の `main` / `types` は `./src/index.ts` を直接指している（Bun ワークスペース前提のソース直参照）
- Jest や Node.js 直接実行から import する際は `moduleNameMapper` 等の設定が必要
