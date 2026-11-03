# デプロイ手順（ローカル・ステージング）

PhysiFun を手元で動かす手順と、ステージング（文書によっては「リハーサル」とも呼ぶ）に出す手順をまとめる。
本番の Supabase プロジェクトはまだ無い。本番を作るときは、ステージングと同じ手順をもう 1 回なぞる。

| 環境 | DB・Storage | アプリ |
|---|---|---|
| ローカル | Supabase ローカル（Docker。`make start`） | `bun dev`（web: 3000）/ `bun run dev:all`（web と admin: 3000・3001） |
| ステージング | Supabase の `Physifun-staging`（project ref `ijcgtaccbiquhrvvipnf`） | Vercel の 2 プロジェクト（web は `https://physical-funding-staging.vercel.app`）。main から自動でデプロイ |

環境変数の一覧は、アプリごとの README（[web](../../apps/web/README.md#環境変数)・[admin](../../apps/admin/README.md#環境変数)）を正とする。
マイグレーションの作り方は [`db-migration.md`](./db-migration.md)、DB の権限の設計は [`04_security-design.md`](../specs/04_security-design.md) §4.5 を参照。

---

## 1. ローカル

### 1.1 用意するもの

- Docker Desktop（起動しておく）
- Supabase CLI **v3 以上**（`apps/web/supabase/config.toml` は v3 の書き方 `[local_smtp]` にしてある。PR #366）
- Atlas CLI（`curl -sSf https://atlasgo.sh | sh` か `brew install ariga/tap/atlas`）
- Bun、Node.js 22 以上（ルートの [`README.md`](../../README.md#前提条件)）

macOS では、次の 2 つで止まることがある。

- `make` が動かない → Xcode のライセンスに同意する（`sudo xcodebuild -license accept`）
- `brew install supabase/tap/supabase` が「Command Line Tools が macOS に対応していない」で止まる → Command Line Tools を更新する。
  すぐに動かしたいときは `npx supabase …` で代用できる（`bunx` は postinstall を動かさないので、本体が入らないことがある）

### 1.2 起動

```bash
bun install
make start                        # = supabase start --workdir apps/web
make status                       # 接続情報（DB の URL・Secret key）を表示する
```

`apps/web/.env.local` と `apps/admin/.env.local` を `.env.example` から作る（[`README.md`](../../README.md#3-環境変数の設定)）。
`DATABASE_URL` はローカルの `postgresql://postgres:postgres@127.0.0.1:54322/postgres`。

### 1.3 マイグレーション

```bash
bun run db:migrate:status         # 未適用の件数を確かめる
bun run db:migrate:deploy         # 未適用をすべて当てる
SEED_ADMIN_EMAIL="you@example.com" bun run db:seed   # admin にログインするとき。何度実行してもよい
```

`db:*` は `apps/web/.env.local`（なければ `apps/web/.env`）の `DATABASE_URL` を読む。
ただし、リポジトリのルートに `.env` がある（`make env-setup` が作る）と、Bun がそれを先に読み、そちらが効く。

### 1.4 アプリ

```bash
bun dev                           # web だけ（http://localhost:3000）
bun run dev:all                   # web と admin（http://localhost:3001）
```

- 画像を置く `project-images` バケットは、`apps/web/supabase/config.toml` の `[storage.buckets.project-images]` から `supabase start` が自動で作る。
  ステージング・本番では手で作る（§2.3）
- admin のログインはメールのリンク方式（Magic Link）。メールは Resend で実際に送られるので、`RESEND_API_KEY` と、開けるアドレスで seed した運営アカウントが要る。
  手順は [`apps/admin/README.md`](../../apps/admin/README.md#ログイン)

---

## 2. ステージングの DB と Storage

main にマージしても、CI はステージングの DB にマイグレーションを当てない。
一方、Vercel は main から自動でデプロイする。**マイグレーションを足した PR をマージしたら、すぐに手元からステージングの DB に当てる**（新しいコードが古い DB で動く時間を短くする）。
表の形を変えないマイグレーション（データの修正・権限の変更）も同じ。

ふつうはこの順番でよいが、**古いコードと新しいコードの片方でしか動かないマイグレーション**は、この順番だと壊れることがある。
例: `20261027233716_story_document.sql` は、新しいコードが本文を書く前に流す必要がある（ファイルの先頭のコメント）。
こういうマイグレーションを足す PR は、出す順番（マージの前に当てるか、書き込みを止めてから当てるか）を PR 本文に書き、その順番で出す。

- 列や表を足すだけなど、古いコードでも動くものは、マージの前に当ててよい
- 列を消す・名前を変えるときは、PR を 2 回に分ける（先にコードがその列を使わないようにし、次の PR で消す）

### 2.1 マイグレーション

接続先の URL は、Supabase のダッシュボードの **Connect** から取る。

- **Direct 接続**（`db.<project-ref>.supabase.co:5432`）か **Session Pooler**（`*.pooler.supabase.com:5432`）を使う。Direct 接続は IPv6 だけなので、手元が IPv6 に対応していなければ Session Pooler
- **Transaction Pooler（ポート 6543）は使わない**。これはアプリ（Vercel の `DATABASE_URL`）用

**同じターミナルで** 続けて実行する。

```bash
git switch main && git pull       # 1. マージしたマイグレーションのファイルを手元に持ってくる

read -rs DATABASE_URL             # 2. URL を貼り付けて Enter（画面と履歴に残らない）
export DATABASE_URL
echo "${DATABASE_URL#*@}"         # 3. 接続先のホストを表示する（パスワードは出ない）。db.<project-ref>.supabase.co などか

bun run db:migrate:status         # 4. 未適用（Pending Files）を確かめる
bun run db:migrate:deploy         # 5. 当てる
bun run db:migrate:status         # 6. 「Migration Status: OK」になったかを確かめる
SEED_ADMIN_EMAIL="you@example.com" bun run db:seed   # 7. 運営アカウントがまだ無いときだけ

unset DATABASE_URL                # 8. 戻す（このあとローカルに向けたコマンドを打っても、ステージングに流れないように）
```

- URL の形は `postgresql://postgres:<パスワード>@db.<project-ref>.supabase.co:5432/postgres`。パスワードに `@`・`:`・`/`・`#` などの記号があれば、URL エンコード（`@` → `%40` など）する
- 手順 1 を飛ばすと、手元に無いマイグレーションは当たらない。Atlas は手元の `atlas/migrations/` と比べるので、それでも「OK」と出る
- `scripts/atlas.ts` と `scripts/seed.ts` は `apps/web/.env.local` を読むが、**すでに設定された環境変数は上書きしない**。`export` した値が使われる
- 逆に、`export` が効いていないと黙ってローカルの DB に流れる。手順 3 でホストがステージングになっていることを確かめてから手順 4 に進む
- **Claude Code の `!` 入力は、1 行ごとに新しいシェルで動く**。`! export DATABASE_URL=...` は次の行に引き継がれず、ローカルに流れる。ステージングに当てるときは自分のターミナルで実行する
- Prisma の時代に作った DB を初めて Atlas に切り替えるときは [`db-migration.md`](./db-migration.md) §5.5

### 2.2 マイグレーションのあとの確認

1. [`04_security-design.md`](../specs/04_security-design.md) §4.5 の 2 つの SQL を、Supabase の SQL Editor で実行し、**どちらも 0 行**になることを確かめる（`anon` などに `public` の表・関数の権限が残っていない）
2. Data API をオフにする（ダッシュボードの「Enable Data API」をオフ）。一度オフにすれば、マイグレーションのたびにする必要はない。オフのままかを確かめる

### 2.3 Storage バケット（環境ごとに 1 回）

アプリはバケットを作らない。Supabase のダッシュボード（Storage → New bucket）で作る。

| 項目 | 値 |
|---|---|
| 名前 | `project-images`（`SUPABASE_STORAGE_BUCKET` の既定） |
| Public bucket | ON |
| File size limit | 4 MB |
| Allowed MIME types | `image/jpeg, image/png, image/webp` |

値の理由は [`apps/web/README.md`](../../apps/web/README.md#storage-バケット)。ローカルの `config.toml` は上限が緩い（50 MiB・gif も可）が、アプリ側の検査（4 MB・3 形式）で同じに絞られる。

---

## 3. Vercel

### 3.1 構成

web と admin は**別の Vercel プロジェクト**（Cookie・環境変数を分けるため。[`apps/admin/README.md`](../../apps/admin/README.md#なぜ-web-と別プロジェクトか)）。

| 項目 | web | admin |
|---|---|---|
| Root Directory | `apps/web` | `apps/admin` |
| Production Branch | `main` | `main` |
| 設定ファイル | `apps/web/vercel.json` | `apps/admin/vercel.json` |
| Cron（Hobby プランなので 1 日 1 回） | `/api/cron/cleanup-expired-accounts`・`/api/cron/process-outbox` | `/api/cron/gc-admin-auth` |

- どちらも `installCommand` は `cd ../.. && bun install`（monorepo のルートで入れる）
- 環境変数は各プロジェクトの Settings → Environment Variables。アプリの `DATABASE_URL` は Transaction Pooler（6543）。足し方・落とし穴は §3.5
- 環境変数を変えたら、再デプロイするまで反映されない（§3.3）
- 新しいプロジェクトを作るとき（初回セットアップ・ドメイン）は [`apps/admin/README.md`](../../apps/admin/README.md#vercel-デプロイ手順-初回セットアップ)

### 3.2 自動デプロイが動いているかを確かめる

main にマージしたら、各プロジェクトで次を見る。

1. **Deployments**: いちばん上の Production のデプロイが、マージしたコミットになっているか。Ready・Error・Canceled のどれか
2. **Settings → Git**: GitHub の `Physicalfunding/PhysiFun` につながっているか
3. **Settings → Build and Deployment**:
   - Production Branch が `main` か
   - Ignored Build Step にコマンドが入っていないか（入っていると、条件に当たったコミットのビルドが Canceled になる）
   - Root Directory の「Skip deployment」が有効なら、そのアプリと、それが使う workspace のパッケージ（`packages/*` など）が変わらないコミットではデプロイされない（Bun workspaces を見て Vercel が判定する）。
     ただし workspace の外（`docs/`・ルートのファイル）が変わったコミットは、全アプリをデプロイする扱いになる。たとえば `apps/admin/` だけを変えた PR では、web はデプロイされないのが正しい

workspace の外を変えたコミットでも新しいデプロイが 1 件も出ていなければ、Git の連携が切れている（Settings → Git を見直す）。

### 3.3 手でデプロイする（ダッシュボード）

- **Redeploy**: Deployments → 対象のデプロイの「…」→ Redeploy。**そのデプロイと同じコミットを**ビルドし直す。環境変数を変えたあとに使う。
  古いデプロイを Redeploy しても新しいコードにはならない
- **Create Deployment**: Deployments → Create Deployment で、ブランチ名（`main`）かコミットの SHA を入れる。そのブランチの最新（またはそのコミット）をビルドする。
  自動デプロイが止まっていて、main の最新を出したいときはこちら

### 3.4 手でデプロイする（Vercel CLI）

手元の作業ツリーから直接デプロイする方法。**Git のコミットではなく、手元のファイルがそのまま上がる**。

```bash
npm i -g vercel                   # 入っていなければ
vercel login

# 作業ツリーを main の最新にする。未コミットの変更・未追跡のファイルがあれば片づける
git switch main && git pull
git status                        # 「nothing to commit, working tree clean」になるまで出さない
git status --ignored              # .gitignore で隠れたファイルも見る（下の注意）

# リポジトリのルートで 1 回だけ。web と admin の 2 プロジェクトをまとめて紐づける
vercel link --repo                # .vercel/repo.json ができる（.gitignore 済み）

# アプリのディレクトリで実行する。そのディレクトリを Root Directory に持つプロジェクトが選ばれる
(cd apps/web && vercel deploy --prod)
(cd apps/admin && vercel deploy --prod)
```

- `vercel link --repo` は、Vercel のプロジェクトが Git 連携していることが前提（Vercel の文書では Alpha 扱い）
- `--prod` を付けると Production（= 今はステージングの URL）に出る。付けなければ Preview の URL になる。まず Preview で確かめてもよい
- デプロイには、ダッシュボードに登録した環境変数が使われる（手元の `.env.local` は使われない）
- `vercel deploy` が既定で上げないのは `.env.local` などで、ルートの `.env`（`make env-setup` が作る）は上がってしまう。`git status --ignored` に `.env` が出たら、退避してから出す
- この節は Vercel の公式文書（`vercel link`・`vercel deploy`・Monorepos）と Vercel CLI のソースで確かめて書いた（2026-11-03）。まだこのリポジトリで実行していないので、動きが違ったら直す

### 3.5 環境変数

しばらくステージングに出していなかったときや、必須の環境変数を足す PR を出すときは、`apps/web/.env.example`・`apps/admin/.env.example` と、Vercel の各プロジェクトの環境変数を 1 つずつ突き合わせる。

- **Production に入れる**。ステージングは main からのビルドなので、Vercel は Production として扱う。Preview だけに入れても届かない
- 値を貼るときは、**末尾に改行が入らないように**する（§5 の「画像のアップロードは通るのに表示が 400」）
- 入れたら Redeploy する（§3.3）。`NEXT_PUBLIC_*` はビルドのときに JS に埋め込まれるので、入れる前のビルドには入っていない

2026-11-03 にステージングへ出したとき（前回のビルドは 2026-05-10 の `a4e5aa3`）に、足りずに止まったものを次に書く。

#### Upstash Redis（web・admin。必須）

レート制限のカウンタを置く（2026-10-16 の `ca37b80` から必須）。`VERCEL_ENV=production` で接続情報が無いと、`packages/infrastructure/src/rate-limit/createRateLimiter.ts` が throw し、応募 API などが 500 になる。

- Vercel の Storage → **Upstash for Redis** で DB を作り、web と admin の両方のプロジェクトに **Production で**つなぐ。`KV_REST_API_URL` / `KV_REST_API_TOKEN` が自動で入る（コードは `UPSTASH_REDIS_REST_*` が無ければこの名前を読む）
- web と admin は同じ DB でよい（キーの接頭辞で分けている）
- リージョンは東京にする（Vercel の関数が `hnd1` で動くため）

#### Cloudflare Turnstile（web。必須）

リーダー応募フォームの CAPTCHA。

- Cloudflare でウィジェットを作る。Hostname に `physical-funding-staging.vercel.app`、Mode は Managed
- Site Key → `NEXT_PUBLIC_TURNSTILE_SITE_KEY`、Secret Key → `TURNSTILE_SECRET_KEY`。どちらも Production に入れ、ビルドし直す
- サイトキーだけ入ってシークレットが無いと、`apps/web/src/lib/captcha.ts` の起動時のチェックで throw し、応募 API が 500 になる。2 つは同時に入れる

#### メール（web・admin）

メールまわりの変数は、**無くても画面はエラーにならない**ので気づきにくい。応募・承認などの API は、レスポンスを返したあと（`after()`）に Outbox を 1 回まわしてメールを送るが、その失敗は try/catch でログに出すだけだから。API は成功し、メールだけ届かない。

| 変数 | web | admin | 無いとどうなるか |
|---|---|---|---|
| `APP_URL` | web の origin | **web の** origin（承認メールのリンク） | Outbox が `APP_URL is not set` で止まり、メールは送信待ちのまま残る |
| `RESEND_API_KEY` | 要る | 要る | **送ったことになって消える**（下） |
| `MAIL_FROM` | 要る | 要る | `noreply@physifun.com` になる。そのドメインが Resend で確認済みでなければ送れない |
| `ADMIN_EMAIL_LIST` | 要る | 要る | 運営あての通知（公開申請など）が `ADMIN_EMAIL_LIST is not set` で止まる |
| `CRON_SECRET` | 要る | 要る | cron が 500 になる（`packages/server-shared/src/cronAuth.ts`。設定漏れで誰でも叩けるようにならないよう、止める作り） |

- **落とし穴**: `RESEND_API_KEY` が無いと、メールの送り手は何もしない `NoopMailSender` になり、送信は成功として返る。`APP_URL` だけ入れて `RESEND_API_KEY` を入れ忘れると、送信待ちのメールが届かないまま送信済みになって消える。web には `APP_URL`・`RESEND_API_KEY`・`MAIL_FROM` を**同時に**入れる
- 送信待ちのメールを今すぐ送るには §5 の「送信待ちのメールを今すぐ送る」

---

## 4. ステージングに出すときの順番（まとめ）

1. 必須の環境変数を足す PR なら、マージの前に §3.5 で Vercel の Production に入れておく
2. PR を main にマージする（Vercel が自動でデプロイを始める）
3. マイグレーションを足した PR なら、§2.1 でステージングの DB に当て、§2.2 を確かめる（古いコードと新しいコードの片方でしか動かないものは、PR に書いた順番で）
4. §3.2 で、web・admin の両方に新しいデプロイが出て Ready になったかを確かめる。出ていなければ §3.3 か §3.4
5. 画面で動きを確かめる。メールが届くかも見る（届かなければ §5）

---

## 5. うまく動かないとき

### 調べ方

- **ランタイムのログ**: Vercel のダッシュボードの Logs（または Vercel の MCP）。Hobby プランでは **1 時間しか残らない**ので、再現させてすぐに見る
- **`NEXT_PUBLIC_*` がビルドに入ったか**: ブラウザでページの JS を開き、値が埋め込まれているかを見る。
  たとえば Turnstile なら、`sitekey:` に渡す値が `env.NEXT_PUBLIC_TURNSTILE_SITE_KEY` のまま残っていれば、ビルドのときに値が無かった（入れてからビルドし直す）
- **Storage**: Supabase のダッシュボードの Logs の `storage_logs`

### 応募・承認などの API が 500

ログに出たメッセージで見分ける。

- `[rateLimit] Upstash Redis の接続情報が設定されていません` → §3.5 の Upstash
- `[captcha] Misconfiguration: NEXT_PUBLIC_TURNSTILE_SITE_KEY is set but TURNSTILE_SECRET_KEY is missing` → §3.5 の Turnstile

### メールが届かない

画面は成功するので、ログで見る（§3.5 のメール）。

- `[after] … outbox tick failed: APP_URL is not set` → `APP_URL` を入れる
- `ADMIN_EMAIL_LIST is not set` → `ADMIN_EMAIL_LIST` を入れる（web と admin の両方）
- ログに何も出ないのに届かない → `RESEND_API_KEY` が無く、送ったことになっている。消えたメールは戻らないので、もう一度その操作をする

### 送信待ちのメールを今すぐ送る

- admin の Outbox 監視（`/outbox`）の「リトライ」は、送信待ちに戻すだけで、その場では送らない
- web の Vercel プロジェクト → Settings → Cron Jobs で `/api/cron/process-outbox` を **Run** する（web に `CRON_SECRET` が要る）。何もしなくても毎日 0 時（UTC）に動く

### 画像のアップロードは通るのに表示が 400

環境変数の値の末尾に改行が入っている。2026-11-03 には `SUPABASE_STORAGE_BUCKET` で起きた。

- アップロードは、リクエストの URL を解析するときに改行が取り除かれるので通る
- 表示の URL は supabase-js の `getPublicUrl` が作り、改行を `%0A` にして残す（`/object/public/project-images%0A/projects/...`）
- Supabase の `storage_logs` に `%0A` が出ていれば、これ。Vercel で値を貼り直し、Redeploy する。
  直す前に上げた画像は、`%0A` の入った URL のまま本文に保存されているので、上げ直す
