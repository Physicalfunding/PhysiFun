# 運営管理アプリ (`@physifun/admin`)

PhysiFun の運営スタッフ向け審査 UI。`apps/web` とは **別の Vercel プロジェクト** として
`admin.<本番ドメイン>` サブドメインで公開する構成（#147, 親 Issue: #140）。

## なぜ別プロジェクトか

- **Cookie / セッション分離**: 運営セッションが一般ユーザドメインに流出しないようにする。
- **環境変数の分離**: `NEXTAUTH_SECRET`・`CRON_SECRET`・`ADMIN_MAGIC_LINK_HMAC_SECRET` などを
  web 側と混ぜずに管理する。
- **デプロイ独立性**: apps/web のリリースで運営 UI が落ちないようにする。
- **Cron 分離**: Vercel Cron (`0 * * * *`) は admin プロジェクト側でのみ実行する
  (`/api/cron/gc-admin-auth`)。

## ローカル開発

```bash
# ルートで初回のみ
bun install

# 運営アプリの開発サーバー (port 3001)
bun run dev:admin
```

環境変数はルートの `.env.local` に加え、必要に応じて `apps/admin/.env.local` を作成する。
テンプレートは [`apps/admin/.env.example`](./.env.example) を参照。

```bash
cp apps/admin/.env.example apps/admin/.env.local
```

## デプロイ手順 (初回セットアップ)

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

1. Vercel プロジェクトの **Settings → Domains** で `admin.<本番ドメイン>` を追加。
2. DNS プロバイダで CNAME (`admin` → `cname.vercel-dns.com`) を登録。
3. Vercel 側で SSL 証明書が自動発行されることを確認する。

### 3. 環境変数設定

Vercel プロジェクトの **Settings → Environment Variables** に `apps/admin/.env.example`
の全項目を登録する。特に以下は **apps/web と別値** を設定すること:

| 変数名 | 値の方針 |
|---|---|
| `NEXTAUTH_SECRET` | apps/web と別値 (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | `https://admin.<本番ドメイン>` |
| `ADMIN_MAGIC_LINK_HMAC_SECRET` | 32 bytes 以上のランダム値 (apps/web に無い)。**#146 (PR #163) マージ後に必須**。詳細は下記注記 |
| `CRON_SECRET` | Vercel Cron 呼び出し検証用 (apps/admin のみ) |
| `RESEND_API_KEY` | Resend ダッシュボードで発行 |
| `MAIL_FROM` | Resend で verify 済みドメインのアドレス |
| `DATABASE_URL` | apps/web と同じ Supabase PostgreSQL (Pooler URL) |

#### `ADMIN_MAGIC_LINK_HMAC_SECRET` について (#146 / PR #163 連動)

この環境変数はマジックリンクトークンの HMAC 署名 / 検証に使われる。
現在のコード (PR #165 / 本 PR マージ時点) では **未参照** のため空でもビルドは通るが、
#146 (PR #163) がマージされると **必須** になる。

**推奨マージ順序**: #163 (HMAC 化) → #165 (Vercel 分離) → Vercel 環境変数を設定。
逆順 (#165 先行) になる場合は、以下のいずれかで運用する:

1. PR #165 マージ時点では未設定のままにしておき、#163 マージ直前に Vercel 環境変数へ
   `ADMIN_MAGIC_LINK_HMAC_SECRET` を追加してから #163 をマージする。
2. 先に両 PR をマージし、その直後にまとめて Vercel の環境変数を設定する
   (この場合 #163 マージ〜環境変数設定の間は admin ログインが失敗するので、
   メンテ時間帯にまとめて実施する)。

いずれの場合も、`apps/web` とは **別値** を設定すること。`openssl rand -base64 32`
等で 32 bytes 以上のランダム値を生成する。

### 4. Cron の動作確認

デプロイ後、Vercel ダッシュボード → **Crons** タブで
`/api/cron/gc-admin-auth` が毎時 0 分に実行されることを確認する。

### 5. CI/CD パイプライン分離

- GitHub リポジトリ側で `apps/admin/**` 変更時だけ admin Vercel プロジェクトが
  ビルド対象になる設定 (Vercel の **Ignored Build Step** で
  `git diff ${VERCEL_GIT_PREVIOUS_SHA:-HEAD^} HEAD --quiet -- apps/admin packages` の
  判定を入れる。`HEAD^` 単体だと初回デプロイや shallow clone / 浅い履歴で
  `unknown revision` になるため、Vercel が前回成功 SHA を渡す環境変数
  `VERCEL_GIT_PREVIOUS_SHA` を優先し、無ければ `HEAD^` にフォールバックする) を推奨。
- `apps/web` 側でも同様に `apps/web/**` のみビルドするよう設定する。
- GitHub Actions (`.github/workflows/ci.yml`) はモノレポ全体に対してそのまま走らせる
  (lint / typecheck / test は両アプリをまとめてチェックする)。

## Cookie ドメイン分離の仕組み

`apps/admin/src/lib/auth.ts` の `cookies` 設定で:

- `domain` 属性を **未指定** (host-only cookie) にし、`admin.<本番ドメイン>` に完全一致
  したリクエストにしか Cookie が送出されないようにしている。
- CSRF Cookie は `__Host-` プレフィックス (NextAuth デフォルト) を使い、仕様上
  domain 属性を設定できないことを利用してサブドメイン漏れを防ぐ。
- セッション Cookie は本番 (https) のとき `__Secure-` プレフィックス + `secure: true`
  に自動で切り替わる (`NEXTAUTH_URL` が `https://` で始まるかで判定)。

これにより `app.<本番ドメイン>` (apps/web) とは Cookie jar が完全に分かれる。

## 関連 Issue

- 親 Issue: [#140](https://github.com/Physicalfunding/PhysiFun/issues/140)
- 先行 Issue: [#145](https://github.com/Physicalfunding/PhysiFun/issues/145) (AdminAccount 移行)
- 本 Issue: [#147](https://github.com/Physicalfunding/PhysiFun/issues/147)
- 依存 Issue: [#146](https://github.com/Physicalfunding/PhysiFun/issues/146) (HMAC 化, 完了後に `ADMIN_MAGIC_LINK_HMAC_SECRET` が必須)
