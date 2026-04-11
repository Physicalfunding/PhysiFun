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

## 開発環境のセットアップ

### 前提条件

以下がインストールされていること:

- [Bun](https://bun.sh/) (v1.x)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started)

### 1. リポジトリのクローンと依存関係のインストール

```bash
git clone https://github.com/Physicalfunding/PhysiFun.git
cd PhysiFun
bun install
```

### 2. Supabase ローカル環境の起動

Docker Desktop が起動していることを確認してから実行してください。

```bash
supabase start
```

起動後、以下の情報が表示されます（`.env.local` の設定に使用します）:

```
Studio   : http://127.0.0.1:54323     # DB 管理画面
Database : postgresql://postgres:postgres@127.0.0.1:54322/postgres
API URL  : http://127.0.0.1:54321
```

### 3. 環境変数の設定

`.env.example` を参考に `.env.local` を作成します。

```bash
cp .env.example .env.local
```

`.env.local` を編集し、Supabase ローカルの接続情報を設定します:

```env
# Database（Supabase ローカル）
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

# Authentication
NEXTAUTH_SECRET="local-dev-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# Storage（Supabase ローカル）
# supabase start 時に表示された値を設定
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
NEXT_PUBLIC_SUPABASE_ANON_KEY="（supabase start で表示された Publishable キー）"
SUPABASE_SERVICE_ROLE_KEY="（supabase start で表示された Secret キー）"
SUPABASE_STORAGE_BUCKET="project-images"
```

> **Note:** `.env.local` は `.gitignore` に含まれているため、git には追跡されません。

### 4. データベースのマイグレーション

```bash
bunx prisma migrate deploy
bunx prisma generate
```

### 5. 開発サーバーの起動

```bash
bun dev
```

http://localhost:3000 でアプリケーションにアクセスできます。

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
# 開発
bun dev                    # 開発サーバー起動
bun run build              # ビルド
bun run lint               # Lint
bun run format             # Prettier フォーマット

# テスト
bun run test               # テスト実行
bun run test:watch         # テスト（ウォッチモード）
bun run test:coverage      # カバレッジ付きテスト

# データベース
bunx prisma migrate deploy # マイグレーション適用
bunx prisma generate       # Prisma Client 生成
bunx prisma studio         # Prisma Studio（DB 管理 GUI）

# Supabase ローカル
supabase start             # ローカル環境起動
supabase stop              # ローカル環境停止
supabase status            # 起動状態・接続情報の確認
```

---

## ドキュメント

詳細なドキュメントは `.docs/` ディレクトリにあります。

| ファイル | 内容 |
|---|---|
| [`.docs/product.md`](.docs/product.md) | プロダクト方針・フェーズ計画 |
| [`.docs/tech.md`](.docs/tech.md) | 技術スタック・インフラ |
| [`.docs/structure.md`](.docs/structure.md) | ディレクトリ構成・命名規則 |
| [`.docs/dev-rule.md`](.docs/dev-rule.md) | 開発フロー・PR ルール |
| [`.docs/requirements.md`](.docs/requirements.md) | 要件定義 |
| [`.docs/design.md`](.docs/design.md) | 設計書 |
