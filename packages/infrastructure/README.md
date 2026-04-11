# @physifun/infrastructure

PhysiFun のインフラ層。外部サービス（Prisma / Supabase Storage / Resend 等）との接続実装をここに集約する。

## スコープ

- `database/` — Prisma Client シングルトン、リポジトリ実装
- `outbox/` — Outbox ワーカー（`LeaderApplicationOutboxMessage` / `ProjectOutboxMessage`）
- `mail/` — `MailSender` インターフェースと実装（Resend など）
- `storage/` — Supabase Storage アダプタ

## 原則

- `@physifun/domain` で定義されたリポジトリインターフェースを実装する
- 環境変数の読み込みはこの層で完結させる
- `apps/web` / `apps/admin` からは DI を通してのみ利用する

詳細は `PhysiFun/.docs/structure.md` を参照。

## 利用上の注意

- `package.json` の `main` / `types` は `./src/index.ts` を直接指している（Bun ワークスペース前提のソース直参照）
- Jest や Node.js 直接実行から import する際は `moduleNameMapper` 等の設定が必要
