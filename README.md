# フィジファン（PhysiFun）

お金ではなく、**スキルと時間**でプロジェクトを支援するフィジカルファンディングプラットフォーム。

古民家再生、米作り、DIY など——プロジェクトオーナーとサポーターをつなぎ、
参加したサポーターはリターン（体験・成果物など）を受け取る仕組みです。

## 技術スタック

| カテゴリ | 技術 |
|---|---|
| フレームワーク | Next.js 16 (App Router) / React 19 / TypeScript 5 |
| スタイリング | Tailwind CSS 4 |
| 認証 | NextAuth.js v4 |
| DB | PostgreSQL (Supabase) + Prisma ORM |
| ストレージ | Supabase Storage |
| ホスティング | Vercel |
| パッケージマネージャ | Bun |

## フェーズ別リリース計画

当初は 3 フェーズ構成だったが、リーダー募集とリーダー機能を統合して 2 フェーズに再編した。

| Phase | 内容 | 状態 |
|---|---|---|
| Phase 1 | リーダー募集 + リーダー機能（LP + 応募フォーム / 運営によるアカウント発行 / プロジェクト作成・編集 / サポート募集準備） | 開発中 |
| Phase 2 | 一般公開（サポーター自由登録 / プロジェクト閲覧 / サポート申請） | 未着手 |

Phase 移行はランタイムのフィーチャーフラグではなく、**コード変更リリース**で行います（Phase 2 リリース PR の中で Phase 1 専用コードを削除する方針）。詳細は `.docs/product.md` を参照。

---

## アプリケーション構成

monorepo（bun workspaces）構成で、以下の 2 つの Next.js アプリと共有パッケージから成る。

| パス | 役割 | ポート | 詳細 |
|---|---|---|---|
| `apps/web` | 一般ユーザ向けアプリ（LP / リーダー応募 / マイページ等） | **3000** | [`apps/web/README.md`](./apps/web/README.md) |
| `apps/admin` | 運営管理アプリ（応募審査 / プロジェクト審査 / 運営メンバー管理） | **3001** | [`apps/admin/README.md`](./apps/admin/README.md) |
| `packages/domain` | ドメイン層（エンティティ / 値オブジェクト / リポジトリ IF） | ー | ー |
| `packages/application` | アプリケーション層（ユースケース） | ー | ー |
| `packages/infrastructure` | インフラ層（Prisma / Supabase Storage / メール送信 / Outbox） | ー | ー |
| `packages/ui-shared` | 両アプリで共有する UI コンポーネント | ー | ー |

DB（Supabase PostgreSQL）は web / admin で **同一インスタンスを共有**するが、Cookie / セッション / 環境変数は完全に分離されている（`AdminAccount` は `Account` と独立アグリゲート）。

---

## 開発環境のセットアップ

### 前提条件

以下がインストールされていること:

- [Bun](https://bun.sh/) (v1.x)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started)
- [Resend](https://resend.com/) の API キー（admin の Magic Link ログインで使用）

### 1. リポジトリのクローンと依存関係のインストール

```bash
git clone https://github.com/Physicalfunding/PhysiFun.git
cd PhysiFun
bun install
```

### 2. Supabase ローカル環境の起動

Docker Desktop が起動していることを確認してから、リポジトリルートで実行する:

```bash
make start          # = supabase start
```

起動後、`make status`（= `supabase status`）で接続情報が確認できる:

```
Studio   : http://127.0.0.1:54323     # DB 管理 GUI
Database : postgresql://postgres:postgres@127.0.0.1:54322/postgres
API URL  : http://127.0.0.1:54321
```

### 3. 環境変数の設定

web / admin それぞれの `.env.local` を用意する。

```bash
cp apps/web/.env.example   apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local
```

各ファイルの設定項目は以下を参照:

- web: [`apps/web/README.md`](./apps/web/README.md#環境変数)
- admin: [`apps/admin/README.md`](./apps/admin/README.md#環境変数)

> **Note:** `.env.local` は `.gitignore` に含まれているため、git には追跡されない。

### 4. データベースのマイグレーション

Prisma スキーマは `packages/infrastructure` に集約されており、ルートからエイリアス経由で実行する:

```bash
bun run db:generate          # Prisma Client 生成
bun run db:migrate:deploy    # マイグレーション適用
```

### 5. 初期 AdminAccount の作成（admin ログインに必須）

`apps/admin` は **Magic Link (NextAuth EmailProvider) のみ** でログインする。事前に `AdminAccount` レコードを作成しておく必要がある。

```bash
SEED_ADMIN_EMAIL="you@example.com" \
  bun --cwd packages/infrastructure run db:seed
```

冪等な upsert なので何度実行しても安全。詳細・運用は [`.docs/admin-role-setup.md`](./.docs/admin-role-setup.md) を参照。

### 6. 開発サーバーの起動

#### web のみ起動（一般ユーザ向け、port 3000）

```bash
bun dev
# = bun --filter @physifun/web dev
```

→ http://localhost:3000

#### admin のみ起動（運営管理、port 3001）

```bash
bun run dev:admin
# = bun --filter @physifun/admin dev
```

→ http://localhost:3001

#### web と admin を並列起動

```bash
bun run dev:all
# = bun --filter '@physifun/{web,admin}' dev
```

---

## 環境変数の管理方針

Next.js の環境変数読み込み優先順位を利用して、環境ごとに設定を分離しています。

| ファイル | 用途 | git 管理 |
|---|---|---|
| `.env.example` | 環境変数のテンプレート（設定項目の一覧） | する |
| `.env.local` | ローカル開発の接続情報 | **しない** |
| Vercel 環境変数 | リハーサル / 本番の接続情報 | Vercel ダッシュボードで管理 |

---

## よく使うコマンド

```bash
# 開発サーバー
bun dev                    # web のみ起動（port 3000）
bun run dev:admin          # admin のみ起動（port 3001）
bun run dev:all            # web + admin 並列起動

# ビルド・品質チェック
bun run build              # web のビルド
bun run build:admin        # admin のビルド
bun run lint               # Lint
bun run typecheck          # 型チェック（全 workspace）
bun run format             # Prettier フォーマット

# テスト
bun run test               # web のユニットテスト
bun run test:watch         # ウォッチモード
bun run test:coverage      # カバレッジ
bun run test:infra         # infrastructure 層（vitest）
bun run test:e2e           # Playwright E2E
bun run test:e2e:ui        # Playwright UI モード

# データベース（packages/infrastructure 経由）
bun run db:generate        # Prisma Client 生成
bun run db:migrate         # マイグレーション作成 + 適用（dev）
bun run db:migrate:deploy  # マイグレーション適用のみ（CI / 本番）
bun run db:migrate:reset   # DB リセット
bun run db:push            # スキーマを直接反映（マイグレーション履歴なし）
bun run db:studio          # Prisma Studio

# Supabase ローカル（Makefile 経由でも可）
supabase start             # ローカル環境起動（make start）
supabase stop              # ローカル環境停止（make stop）
supabase status            # 起動状態・接続情報の確認（make status）

# 初期 AdminAccount の seed
SEED_ADMIN_EMAIL="you@example.com" \
  bun --cwd packages/infrastructure run db:seed
```

---

## ドキュメント

### アプリ別 README

| ファイル | 内容 |
|---|---|
| [`apps/web/README.md`](./apps/web/README.md) | 一般ユーザ向けアプリ（web）の構成・環境変数・ローカル起動 |
| [`apps/admin/README.md`](./apps/admin/README.md) | 運営管理アプリ（admin）の構成・環境変数・ローカル起動・Vercel デプロイ |

### 設計・運用ドキュメント

`.docs/` ディレクトリ参照。

| ファイル | 内容 |
|---|---|
| [`.docs/product.md`](.docs/product.md) | プロダクト方針・フェーズ計画 |
| [`.docs/tech.md`](.docs/tech.md) | 技術スタック・インフラ |
| [`.docs/structure.md`](.docs/structure.md) | ディレクトリ構成・命名規則 |
| [`.docs/dev-rule.md`](.docs/dev-rule.md) | 開発フロー・PR ルール |
| [`.docs/requirements.md`](.docs/requirements.md) | 要件定義 |
| [`.docs/design.md`](.docs/design.md) | 設計書 |
| [`.docs/admin-role-setup.md`](.docs/admin-role-setup.md) | 運営アカウント（AdminAccount）のセットアップ・運用手順 |
