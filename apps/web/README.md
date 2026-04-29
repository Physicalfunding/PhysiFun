# 一般ユーザ向けアプリ (`@physifun/web`)

PhysiFun の一般ユーザ（リーダー / サポーター）向けの Next.js アプリ。
本番では `app.<本番ドメイン>` で公開する想定で、`apps/admin` とは Vercel プロジェクト・Cookie・環境変数すべてを分離している。

セットアップの全体フローはリポジトリルートの [`README.md`](../../README.md) を参照。本ドキュメントは web アプリ固有の情報をまとめる。

---

## 役割

- LP（リーダー募集 / Phase 2 でサポーター向けにも拡張）
- リーダー応募フォーム（`/apply`）
- アクティベーション（`/activate`）
- マイページ（`/my`）
- プロジェクト編集 / 公開申請（`/my/projects/...`）
- 公開済みプロジェクトページ（`/projects/...`）
- 認証 API（NextAuth.js v4 / Credentials Provider）

主要ルート:

```
src/app/
├── (auth)/         # ログイン等の認証ページ
├── activate/       # メール経由のパスワード設定
├── api/            # API Route Handler（薄い BFF）
├── apply/          # リーダー応募 LP / フォーム
├── my/             # 認証必須のユーザページ
└── projects/       # 公開プロジェクトページ
```

---

## ローカル開発

### ポート

`next dev`（既定の **3000** 番）。

### 起動

リポジトリルートから:

```bash
bun dev
# = bun --filter @physifun/web dev
```

→ http://localhost:3000

`apps/admin` も同時に起動したい場合は `bun run dev:all`。

### 前提

- Supabase ローカル環境が起動済み（`make start`）
- DB マイグレーション適用済み（`bun run db:migrate:deploy`）
- `apps/web/.env.local` が用意済み

詳細はリポジトリルート README の「開発環境のセットアップ」を参照。

---

## 環境変数

[`apps/web/.env.example`](./.env.example) をコピーして `apps/web/.env.local` を作成する:

```bash
cp apps/web/.env.example apps/web/.env.local
```

| 変数 | 用途 | ローカル開発時の値の例 |
|---|---|---|
| `DATABASE_URL` | Supabase PostgreSQL 接続文字列 | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| `NEXTAUTH_SECRET` | NextAuth セッション署名鍵 | 任意の文字列（本番では `openssl rand -base64 32`） |
| `NEXTAUTH_URL` | アプリの origin（CSRF 検証で使用） | `http://localhost:3000` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL（クライアント露出可） | `http://127.0.0.1:54321` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Publishable キー | `supabase status` の "Publishable key" |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Secret キー（サーバ専用） | `supabase status` の "Secret key" |
| `SUPABASE_STORAGE_BUCKET` | プロジェクト画像用バケット名 | `project-images`（既定） |
| `ADMIN_EMAIL_LIST` | 運営宛通知（Phase 1 用） | カンマ区切り email |
| `RESEND_API_KEY` | アクティベーションメール等の送信 | Resend で発行した API キー |
| `NEXT_PUBLIC_RELEASE_PHASE` | フェーズ管理（`1` / `2`） | `1` |

`NEXTAUTH_URL` の表記ルール（末尾スラッシュ禁止 / デフォルトポート明示禁止 など）は `.env.example` のコメントを参照。

> ⚠️ `apps/web/.env.local` の `NEXTAUTH_SECRET` は **`apps/admin` と必ず別値**にする。

---

## よく使うコマンド

ルートの `bun --filter @physifun/web ...` 経由でも、`apps/web/` で直接 `bun ...` でも動く。

```bash
bun dev                    # 開発サーバー（port 3000）
bun run build              # プロダクションビルド
bun run start              # ビルド済みアプリの起動
bun run lint               # ESLint
bun run typecheck          # tsc --noEmit
bun run test               # Jest（ユニット / コンポーネントテスト）
bun run test:watch         # Jest ウォッチモード
bun run test:coverage      # カバレッジ取得
```

---

## 認証フロー（要点）

- 一般ユーザのログインは NextAuth.js v4 の Credentials Provider（email + password）
- アカウント発行はリーダー応募フォーム送信時に自動（`PENDING_EMAIL_CONFIRMATION` 状態）
- メール内リンクから `/activate?token=...` でパスワード設定 → `ACTIVE` 遷移
- 詳細な状態遷移・ユースケースは `docs-repository/docs/202604_初回リリースに向けた計画/アカウント.md` を参照

> 運営権限は本アプリには存在しない（`Account.roles` は `SUPPORTER` / `LEADER` のみ）。運営機能は `apps/admin` を利用すること。

---

## デプロイ

Vercel プロジェクト（`apps/web`）。詳細は別途インフラドキュメント参照。本 README ではローカル開発の説明に留める。

---

## 関連ドキュメント

- リポジトリルート: [`README.md`](../../README.md)
- 設計・要件: [`.docs/`](../../.docs/)
- 運営アプリ: [`apps/admin/README.md`](../admin/README.md)
- アカウント設計: `docs-repository/docs/202604_初回リリースに向けた計画/アカウント.md`
