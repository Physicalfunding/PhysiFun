# @physifun/infrastructure

PhysiFun のインフラ層。外部サービス（PostgreSQL / Resend 等）との接続実装をここに集約する。

## スコープ

- `src/<context>/` — Port / リポジトリ IF の実装（`KyselyXxxAdapter` / `KyselyXxxQueryService` など）。旧 `PrismaXxx` 実装は Prisma 撤去（#230）まで並存
- `src/database/` — Kysely クライアント・DB 型（`kysely/`）、Prisma Client（移行完了まで）
- `src/outbox/` — Outbox ワーカーとメッセージ種別ごとのプロセッサ
- `src/mail/` — `MailSender` インターフェースと実装（Resend など）
- `src/security/` — パスワードハッシュ（bcrypt）
- `prisma/` — `schema.prisma` / マイグレーション / seed（Atlas 移行完了まで）
- `atlas/` — Atlas の設定・マイグレーション（baseline 未確立）

Kysely 実装は ESM 専用のため、メイン barrel ではなくサブバレル `@physifun/infrastructure/src/kysely` から公開している。移行の詳細は `docs/guides/db-migration.md`。

## 原則

- `@physifun/domain` で定義されたリポジトリインターフェースを実装する
- 環境変数の読み込みはこの層で完結させる
- `apps/web` / `apps/admin` からは DI を通してのみ利用する

レイヤー責務は `docs/specs/01_system-architecture.md` §4 を参照。

## 利用上の注意

- `package.json` の `main` / `types` は `./src/index.ts` を直接指している（Bun ワークスペース前提のソース直参照）
- Jest や Node.js 直接実行から import する際は `moduleNameMapper` 等の設定が必要

## テスト (Issue #122)

このパッケージは 2 系統のテストを持つ。

### 1. `src/**/__tests__/*.test.ts` (bun test / Jest 互換)

DB に接続しないユニットテスト（Outbox Worker / Mail / Bcrypt / HMAC 等）。
リポジトリルートの `bun test apps packages` からまとめて実行される。Docker 不要。

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
  - 起動直後に `bun prisma migrate deploy` でスキーマを適用
  - 各テストは `test/helpers/prisma.ts` の `getTestPrisma()` で接続し、`resetDatabase()` で毎回クリーンアップ
- 既存 DB を使う場合（Docker を使いたくない、または docker-compose 管理の DB を流用する）:
  ```bash
  INFRA_TEST_DATABASE_URL="postgresql://user:pass@localhost:5432/physifun_test" \
    bun --filter @physifun/infrastructure test
  ```
  この場合は Testcontainers を起動せず、指定された URL に対して migrate deploy + テストを実行する。

### テストファイル配置ルール

- `src/**/__tests__/*.test.ts` — Jest 互換の純粋なユニットテスト (bun test 対象)
- `test/**/*.vitest.ts` — vitest + Testcontainers による integration test
  - bun test は `*.test.ts` / `*.spec.ts` 系のみを拾うため、`*.vitest.ts` 命名で自然に棲み分けできる
