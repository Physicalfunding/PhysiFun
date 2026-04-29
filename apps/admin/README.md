# 運営管理アプリ (`@physifun/admin`)

PhysiFun の運営スタッフ向け審査 UI。`apps/web` とは **別の Vercel プロジェクト** として
`admin.<本番ドメイン>` サブドメインで公開する構成（#147, 親 Issue: #140）。

セットアップの全体フローはリポジトリルートの [`README.md`](../../README.md) を参照。本ドキュメントは admin アプリ固有の情報をまとめる。

---

## 役割

- リーダー応募の審査（`/applications`）
- プロジェクトの公開審査・強制非公開（`/projects`）
- 運営メンバー管理（`/members`）
- 監査ログ閲覧（`/audit-logs`）
- Outbox 手動操作（`/outbox`）
- Magic Link によるログイン（`/login`）

主要ルート:

```
src/app/
├── api/             # /api/auth, /api/cron/gc-admin-auth など
├── applications/    # リーダー応募審査
├── audit-logs/      # AdminAuditLog 閲覧
├── login/           # Magic Link ログイン入口
├── members/         # AdminAccount 追加・無効化・再有効化
├── outbox/          # Outbox 状態確認・再送
└── projects/        # プロジェクト審査・強制非公開
```

---

## なぜ web と別プロジェクトか

- **Cookie / セッション分離**: 運営セッションが一般ユーザドメインに流出しないようにする
- **環境変数の分離**: `NEXTAUTH_SECRET` / `CRON_SECRET` / `ADMIN_MAGIC_LINK_HMAC_SECRET` などを web 側と混ぜずに管理
- **デプロイ独立性**: `apps/web` のリリースで運営 UI が落ちないようにする
- **Cron 分離**: Vercel Cron (`0 * * * *`) は admin プロジェクト側でのみ実行する（`/api/cron/gc-admin-auth`）

---

## 認証方式

**Magic Link (NextAuth EmailProvider) + Database セッション戦略のみ**。
パスワード / TOTP / リカバリコードは採用していない（#145 でカラム自体が DROP 済み）。

ログインフロー（要点）:

1. 運営が `/login` で email を入力
2. `signIn` callback で AdminAccount が `ACTIVE` で実在するかチェック + email 単位のレート制限（5 req / 15 min）を消費
3. Magic Link URL を生成し、`ADMIN_MAGIC_LINK_HMAC_SECRET` で HMAC-SHA256 署名（`sig` クエリ）を付与（#146）
4. Resend API 経由でメール送信
5. リンククリック → `/api/auth/callback/email` で署名検証 → `AdminVerificationToken` を消費し `AdminSession` を発行（TTL 1h）

セッションは `AdminSession` 行を DB から削除すれば即座に強制 revoke される。

設計の詳細は以下を参照:

- [`docs-repository/docs/202604_初回リリースに向けた計画/運営アプリ.md`](../../../docs-repository/docs/202604_初回リリースに向けた計画/運営アプリ.md)
- [`docs-repository/docs/202604_初回リリースに向けた計画/アカウント.md`](../../../docs-repository/docs/202604_初回リリースに向けた計画/アカウント.md) の「運営アカウント (AdminAccount)」セクション
- [`.docs/admin-role-setup.md`](../../.docs/admin-role-setup.md)（運用手順）

---

## ローカル開発

### ポート

`next dev --port 3001`。

### 前提

- Supabase ローカル環境が起動済み（`make start`）
- DB マイグレーション適用済み（`bun run db:migrate:deploy`）
- `apps/admin/.env.local` が用意済み（後述）
- 初期 `AdminAccount` が seed 済み（後述）
- Resend API キーを所持していること（Magic Link 送信に必須）

### 起動

リポジトリルートから:

```bash
bun run dev:admin
# = bun --filter @physifun/admin dev
```

→ http://localhost:3001

`apps/web` も同時に起動したい場合は `bun run dev:all`。

### 初期 AdminAccount の作成

admin は **既知の email にしか Magic Link を送らない**ため、ログイン前に `AdminAccount` レコードを作成しておく必要がある。

```bash
SEED_ADMIN_EMAIL="you@example.com" \
  bun --cwd packages/infrastructure run db:seed
```

冪等な upsert なので何度実行しても安全。ローカル開発では Resend で送られたメールを実際に開けるアドレスを指定すること。

代替として Supabase Studio から直接 SQL でも追加可能:

```sql
INSERT INTO admin_accounts (id, email, status, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'you@example.com', 'ACTIVE', NOW(), NOW());
```

詳細・運用中のメンバー追加 / 無効化 / 緊急 revoke 手順は [`.docs/admin-role-setup.md`](../../.docs/admin-role-setup.md) を参照。

### ログイン

1. http://localhost:3001/login にアクセス
2. seed した email を入力 → 「ログインリンクを送信」
3. Resend 経由で送られたメールを開き、リンクをクリック
4. `/applications` 等の保護されたページにアクセスできることを確認

---

## 環境変数

[`apps/admin/.env.example`](./.env.example) をコピーして `apps/admin/.env.local` を作成する:

```bash
cp apps/admin/.env.example apps/admin/.env.local
```

| 変数 | 用途 | ローカル開発時の値の例 | 必須 |
|---|---|---|:---:|
| `DATABASE_URL` | Supabase PostgreSQL（web と同一 DB） | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` | ✅ |
| `NEXTAUTH_SECRET` | NextAuth セッション署名鍵 | 任意の文字列（**web と別値**） | ✅ |
| `NEXTAUTH_URL` | Magic Link URL の origin | `http://localhost:3001` | ✅ |
| `ADMIN_MAGIC_LINK_HMAC_SECRET` | Magic Link URL の HMAC 署名鍵 | `openssl rand -base64 32` 等で生成（**`NEXTAUTH_SECRET` と別値**） | ✅ |
| `RESEND_API_KEY` | Magic Link メール送信 | Resend で発行した API キー | ✅ |
| `MAIL_FROM` | Magic Link 送信元アドレス | 例: `"PhysiFun 運営" <noreply@example.com>` | ✅ |
| `CRON_SECRET` | `/api/cron/gc-admin-auth` の Authorization 検証 | 任意の文字列 | ✅ |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL（審査画像表示用 / #120） | `http://127.0.0.1:54321` | ◯ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Publishable キー | `supabase status` の値 | ◯ |

> ⚠️ `NEXTAUTH_SECRET` と `ADMIN_MAGIC_LINK_HMAC_SECRET` は **必ず別値**にすること。同一値で運用すると HMAC 検証層を回避された場合に署名と Cookie の独立性が崩れる。

> ⚠️ `ADMIN_MAGIC_LINK_HMAC_SECRET` は `apps/admin/src/lib/auth.ts` の起動時アサート（`assertAdminMagicLinkHmacSecretOnBoot`）で **未設定なら fail-closed で throw** する。ローカルでも必ず設定すること。

---

## よく使うコマンド

ルートの `bun --filter @physifun/admin ...` 経由でも、`apps/admin/` で直接 `bun ...` でも動く。

```bash
bun run dev                # 開発サーバー（port 3001）
bun run build              # プロダクションビルド
bun run start              # ビルド済みアプリの起動
bun run lint               # ESLint
bun run typecheck          # tsc --noEmit
```

ルートからは:

```bash
bun run dev:admin          # 開発サーバー
bun run build:admin        # ビルド
```

---

## Vercel デプロイ手順 (初回セットアップ)

### 1. Vercel プロジェクト作成

Vercel ダッシュボードで **新規プロジェクト** を作成:

- Repository: `Physicalfunding/PhysiFun`
- Root Directory: `apps/admin`
- Framework Preset: Next.js (自動検出)
- Build Command: 既定 (`next build`)
- Install Command: `bun install` (monorepo なのでルートから実行される)
- Production Branch: `main`

Preview デプロイも同プロジェクトで自動生成されるため、`apps/web` 側の Vercel プロジェクト
とは **完全に独立したプレビュー URL** になる。

### 2. サブドメイン設定

1. Vercel プロジェクトの **Settings → Domains** で `admin.<本番ドメイン>` を追加
2. DNS プロバイダで CNAME (`admin` → `cname.vercel-dns.com`) を登録
3. Vercel 側で SSL 証明書が自動発行されることを確認する

### 3. 環境変数設定

Vercel プロジェクトの **Settings → Environment Variables** に [`apps/admin/.env.example`](./.env.example) の全項目を登録する。特に以下は **apps/web と別値** を設定すること:

| 変数名 | 値の方針 |
|---|---|
| `NEXTAUTH_SECRET` | apps/web と別値 (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | `https://admin.<本番ドメイン>` |
| `ADMIN_MAGIC_LINK_HMAC_SECRET` | 32 bytes 以上のランダム値 (apps/web に無い) |
| `CRON_SECRET` | Vercel Cron 呼び出し検証用 (apps/admin のみ) |
| `RESEND_API_KEY` | Resend ダッシュボードで発行 |
| `MAIL_FROM` | Resend で verify 済みドメインのアドレス |
| `DATABASE_URL` | apps/web と同じ Supabase PostgreSQL (Pooler URL) |

### 4. Cron の動作確認

デプロイ後、Vercel ダッシュボード → **Crons** タブで `/api/cron/gc-admin-auth` が毎時 0 分に実行されることを確認する。

ローカル / E2E では cron は走らないため、テスト側から以下を直接叩いて検証する:

```bash
curl -H "authorization: Bearer ${CRON_SECRET}" \
  http://localhost:3001/api/cron/gc-admin-auth
```

### 5. CI/CD パイプライン分離

- GitHub リポジトリ側で `apps/admin/**` 変更時だけ admin Vercel プロジェクトがビルド対象になる設定（Vercel の **Ignored Build Step** で `git diff ${VERCEL_GIT_PREVIOUS_SHA:-HEAD^} HEAD --quiet -- apps/admin packages` の判定を入れる。`HEAD^` 単体だと初回デプロイや shallow clone / 浅い履歴で `unknown revision` になるため、Vercel が前回成功 SHA を渡す環境変数 `VERCEL_GIT_PREVIOUS_SHA` を優先し、無ければ `HEAD^` にフォールバックする）を推奨
- `apps/web` 側でも同様に `apps/web/**` のみビルドするよう設定する
- GitHub Actions (`.github/workflows/ci.yml`) はモノレポ全体に対してそのまま走らせる（lint / typecheck / test は両アプリをまとめてチェックする）

---

## Cookie ドメイン分離の仕組み

`apps/admin/src/lib/auth.ts` の `cookies` 設定で:

- `domain` 属性を **未指定** (host-only cookie) にし、`admin.<本番ドメイン>` に完全一致したリクエストにしか Cookie が送出されないようにしている
- CSRF Cookie は `__Host-` プレフィックス (NextAuth デフォルト) を使い、仕様上 domain 属性を設定できないことを利用してサブドメイン漏れを防ぐ
- セッション Cookie は本番 (https) のとき `__Secure-` プレフィックス + `secure: true` に自動で切り替わる (`NEXTAUTH_URL` が `https://` で始まるかで判定)

これにより `app.<本番ドメイン>` (apps/web) とは Cookie jar が完全に分かれる。

---

## 関連 Issue

- 親 Issue: [#140](https://github.com/Physicalfunding/PhysiFun/issues/140)
- 先行 Issue: [#145](https://github.com/Physicalfunding/PhysiFun/issues/145) (AdminAccount 移行)
- Vercel 分離: [#147](https://github.com/Physicalfunding/PhysiFun/issues/147)
- HMAC 化: [#146](https://github.com/Physicalfunding/PhysiFun/issues/146)
- 運営メンバー追加 UI: [#148](https://github.com/Physicalfunding/PhysiFun/issues/148)
- AdminAuditLog UI: [#149](https://github.com/Physicalfunding/PhysiFun/issues/149)

---

## 関連ドキュメント

- リポジトリルート: [`README.md`](../../README.md)
- 一般ユーザアプリ: [`apps/web/README.md`](../web/README.md)
- 運営アカウント運用手順: [`.docs/admin-role-setup.md`](../../.docs/admin-role-setup.md)
- 設計・要件: [`.docs/`](../../.docs/)
