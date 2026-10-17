# @physifun/infrastructure

PhysiFun のインフラ層。外部サービス（PostgreSQL / Resend 等）との接続実装をここに集約する。

## スコープ

- `src/<context>/` — Port / リポジトリ IF の実装（`KyselyXxxAdapter` / `KyselyXxxQueryService` など）
- `src/database/` — Kysely クライアント・DB 型（`kysely/types.ts` は kysely-codegen の生成物。`bun run db:kysely:codegen` で再生成）
- `src/outbox/` — Outbox ワーカーとメッセージ種別ごとのプロセッサ
- `src/mail/` — `MailSender` インターフェースと実装（Resend など）
- `src/security/` — パスワードハッシュ（bcrypt）
- `atlas/` — スキーマの正本（`schema.sql`）と versioned migration（`migrations/`）。設定は `atlas.hcl`
- `scripts/seed.ts` — 初期 AdminAccount の投入（`bun run db:seed`）
- `scripts/atlas.ts` — Atlas CLI のラッパー（`apps/web/.env.local` を読み込んで実行。`bun run db:migrate:*` から使う）

公開 API はすべて `src/index.ts`（`@physifun/infrastructure`）から export する（Kysely 実装も含む。#256 でサブバレルを統合）。クライアントコンポーネントからは型だけを import すること。移行の詳細は `docs/guides/db-migration.md`。

## 原則

- `@physifun/domain` で定義されたリポジトリインターフェースを実装する
- 環境変数の読み込みはこの層で完結させる
- `apps/web` / `apps/admin` からは DI を通してのみ利用する

レイヤー責務は `docs/specs/01_system-architecture.md` §4 を参照。

## 利用上の注意

- `package.json` の `main` / `types` は `./src/index.ts` を直接指している（Bun ワークスペース前提のソース直参照）
- Node.js 直接実行から import する際は TypeScript を解決できる実行環境（bun / Vitest / Next.js など）が必要

## テスト (Issue #122)

このパッケージは 2 系統のテストを持つ。

### 1. `src/**/__tests__/*.test.ts` (Vitest ユニットテスト)

DB に接続しないユニットテスト（Outbox Worker / Mail / Bcrypt / HMAC 等）。
リポジトリルートの `bun run test`（ルートの `vitest.config.ts`）からまとめて実行される。Docker 不要。

### 2. `test/**/*.vitest.ts` (vitest + Testcontainers)

実 PostgreSQL に対してクエリする integration test（Kysely 実装の検証が中心）。

- **Docker 必須**。ローカルで実行する場合は Docker Desktop を起動しておくこと。
- CI では `docker` サービスが使える runner (GitHub Actions の `ubuntu-latest` なら OK) を使う。
- 実行方法:
  ```bash
  # リポジトリルートから
  bun --filter @physifun/infrastructure test
  # or
  bun run test:infra
  # or
  cd packages/infrastructure && bun run test
  ```
- 仕組み:
  - `vitest.config.ts` の `globalSetup` で `@testcontainers/postgresql` の `PostgreSqlContainer` を起動
  - 起動直後に `atlas migrate apply --env local` でスキーマを適用（**Atlas CLI が必要**）
  - 各テストは `test/helpers/db.ts` の Kysely 接続を使い、`resetDatabase()` で毎回クリーンアップ。データ投入は `insertRow` / `insertRows`（`id` / `updatedAt` を自動補完）
- 既存 DB を使う場合（Docker を使いたくない、または docker-compose 管理の DB を流用する）:
  ```bash
  INFRA_TEST_DATABASE_URL="postgresql://user:pass@localhost:5432/physifun_test" \
    bun --filter @physifun/infrastructure test
  ```
  この場合は Testcontainers を起動せず、指定された URL に対してマイグレーション適用 + テストを実行する。

### テストファイル配置ルール

- `src/**/__tests__/*.test.ts` — 純粋なユニットテスト（ルートの `bun run test` 対象）
- `test/**/*.vitest.ts` — vitest + Testcontainers による integration test（`bun run test:infra` 対象）
  - ルートの Vitest 設定は `src/**/*.test.ts` だけを拾うため、`*.vitest.ts` 命名で棲み分けている
