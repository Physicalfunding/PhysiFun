# DB スキーマ・マイグレーション運用ガイド（Kysely + Atlas）

DB アクセスは **Kysely**（SQL ライクな型安全クエリビルダ）、スキーマ / マイグレーション管理は
**Atlas**（宣言的スキーマ + versioned migration）で行う。Prisma からの移行（Epic #221）の経緯もここに残す。

> ステータス: **移行完了**（Epic #221）。Prisma への依存はリポジトリから無くなった。

---

## 1. 全体像

| 役割 | 使うもの | 場所 |
|---|---|---|
| クエリ / コマンド | **Kysely**（`pg` ドライバ） | `packages/infrastructure/src/**/Kysely*.ts` |
| スキーマの正本 | **`atlas/schema.sql`**（宣言的ソース） | `packages/infrastructure/atlas/schema.sql` |
| マイグレーション | **Atlas**（`atlas migrate diff / apply`、versioned） | `packages/infrastructure/atlas/migrations/` |
| DB 型 | **kysely-codegen** の生成物（手で編集しない） | `packages/infrastructure/src/database/kysely/types.ts` |
| テーブル定義書・ER 図 | **tbls** の生成物（手で編集しない。§6） | `docs/db/`（設定は `packages/infrastructure/.tbls.yml`） |

---

## 2. 移行の経緯（最初に PoC として移行した `project` ドメインの例）

- `src/database/kysely/client.ts` — Kysely シングルトン（`pg` Pool、pgBouncer 互換）。
- `src/database/kysely/types.ts` — DB 型（当時は手書き。#230 で kysely-codegen の生成物に置き換えた）。
- `src/project/KyselyProjectQueryService.ts` — `PrismaProjectQueryService` と同一 API の drop-in。
- `src/project/KyselyProjectCommandAdapter.ts` — `PrismaProjectCommandAdapter` と同一 API の drop-in
  （`$transaction` 相当、count→insert の TOCTOU、Outbox 書き込みを含む）。
- `src/kysely.ts` — Kysely 実装のサブバレル（当時は ESM 事情でメイン barrel と分離していた。#256 でメイン barrel に統合済み）。
- DI 切替: `apps/web` / `apps/admin` の project DI が Kysely 実装を生成。
- `test/project/KyselyProject.vitest.ts` — 実 PostgreSQL に対する統合テスト（7 件）。

ドメイン層・ユースケース層・各 Port は**無改修**（Port を一切変えていない）。

---

## 3. Kysely のポイント / 注意

- **カラム名は camelCase**（Prisma が引用識別子で作成済み）。Kysely でも camelCase で参照する。
  そのため既存の `reconstructProject(row)` が Kysely 行でもそのまま動く。
- **count** は `eb.fn.countAll<string>()` で取得し `Number()` 変換（pg は bigint を string で返す）。
- **jsonb**（`snsLinks` / `payload`）は JS オブジェクトを渡せば `pg` が直列化、読み取りは parse 済み。
- **トランザクション**は `db.transaction().execute(async (trx) => { ... })`。コールバック内の
  throw でロールバック（TOCTOU の count→insert を同一 tx で実施）。
- **pgBouncer（Supabase Transaction Pooler）互換**: `pg` は既定で名前付き prepared statement を
  使わないため、Prisma の `pgbouncer=true` のような特別設定は不要。
- **kysely 0.29 は Node >= 22 を要求**（`engines`）。リポジトリ側はルート `package.json` の `engines` と
  `.nvmrc`（22）で固定し、CI も `.nvmrc` を使う。Vercel の web / admin も Node 22 以上に設定する（#249）。

### import 先と ESM の事情
`kysely` は **ESM 専用**（CJS ビルド無し）。以前は apps/web のテストに使っていた Jest から読み込めなかったため、
Kysely 実装をサブバレル `@physifun/infrastructure/src/kysely` に隔離していた。テストを Vitest（ESM 対応）に
統一した（#253）ので、#256 でメイン barrel に統合した。**Kysely 実装も含めて `@physifun/infrastructure` から import する。**
クライアントコンポーネントからは型だけを import する（値を import すると pg / Kysely がクライアントのバンドルに入る）。
E2E（Playwright）は Node の `require(esm)` で Kysely を読み込むため、Node 22 以上で実行する。

---

## 4. kysely-codegen（型生成）

`src/database/kysely/types.ts` は、マイグレーション適用済みの DB から **kysely-codegen で生成する**（#230）。手で編集しない。

```bash
cd packages/infrastructure
bun run db:kysely:codegen   # DATABASE_URL の DB（public スキーマ）から types.ts を生成
bun run db:kysely:verify    # types.ts が DB と一致しているか確認（CI の E2E ジョブでも実行）
```

- `DATABASE_URL` は shell の値、なければ `apps/web/.env.local`（→ `.env`）から読む
- テーブル型は `Accounts` / `Projects` のようなパスカルケース、enum 型は `Role` / `Accountstatus` のような名前で出力される
  （Postgres の enum 名を元に生成されるため、大文字小文字が崩れるものがある）
- NULL 許容カラム（`T | null`）は Kysely の `Insertable` で INSERT 時に省略できる。`id` / `updatedAt` は DB に DEFAULT が無いため必須
- jsonb カラムは `Json` 型。Port から `unknown` で渡る値（Outbox の `payload` など）を書き込むときは、`as Json` で明示する
- 生成物は Prettier の対象外（`.prettierignore`）。整形すると `db:kysely:verify` が差分ありと判定するため

---

## 5. Atlas（スキーマ / マイグレーション管理）

### 5.1 構成

- 設定: `packages/infrastructure/atlas.hcl`（env `local`）
  - 接続先は `DATABASE_URL`。**`public` スキーマに限定**して扱い、Supabase の `auth` / `storage` などには触れない
  - 適用履歴は `atlas_schema_revisions` スキーマに保存する（`public` のテーブルと混ざらない）
  - Prisma 時代の履歴テーブル `_prisma_migrations` は管理対象外（既存 DB に残っていても無視する）
- 正本: `atlas/schema.sql`。生成物: `atlas/migrations/*.sql` と `atlas.sum`（ハッシュ。手で編集しない）
- コマンドは `scripts/atlas.ts` 経由で実行する。`apps/web/.env.local`（なければ `.env`）の `DATABASE_URL` を読み込むが、
  shell で設定した値があればそちらが優先される
- Atlas は URL に `sslmode` が無いと SSL 必須で接続する。`scripts/atlas.ts` は localhost 宛てで `sslmode` 未指定の URL に
  `sslmode=disable` を自動で補う（ローカルの Supabase / PostgreSQL 向け）。Supabase のリモート DB は SSL 対応なのでそのままでよい

### 5.2 セットアップ

```bash
# Atlas CLI のインストール（どちらか）
curl -sSf https://atlasgo.sh | sh
brew install ariga/tap/atlas
```

- `atlas login` は基本的に不要。このプロジェクトはテーブル / enum / インデックス / 外部キー / コメントだけを使っており、
  ログインなしで使える機能で足りる（ビュー・関数・トリガー・拡張機能を使い始めたら見直す）
- ただし `db:migrate:lint`（`atlas migrate lint`）は、Atlas v0.38 以降ログインが必要になった。
  ログインしていないと失敗するので、そのときは生成されたマイグレーションの SQL を目で確認する
- CI は `ariga/setup-atlas@v0` でインストールしている（`test-infrastructure` / `e2e` ジョブ）
- `db:migrate:diff` / `db:migrate:lint` / `db:schema:drift` は差分計算用の**空の使い捨て DB（dev DB）**を使う。
  既定は Docker（`docker://postgres/16/dev`）。Docker を使わない場合は空のデータベースを用意して `ATLAS_DEV_URL` に指定する

### 5.3 コマンド一覧（`packages/infrastructure` の scripts）

| コマンド | 内容 |
|---|---|
| `bun run db:migrate:diff <名前>` | `schema.sql` との差分から versioned migration を生成 |
| `bun run db:migrate:lint` | 最新のマイグレーションを静的検査（破壊的変更など） |
| `bun run db:migrate:deploy` | 未適用のマイグレーションを `DATABASE_URL` に適用 |
| `bun run db:migrate:status` | 適用状況を表示 |
| `bun run db:schema:drift` | `DATABASE_URL` の実スキーマと `schema.sql` のズレを表示（ズレが無ければ `Schemas are synced`） |

`db:migrate:diff` / `db:migrate:deploy` / `db:migrate:status` はルートからも同名で実行できる。

### 5.4 日々のスキーマ変更フロー

```bash
cd packages/infrastructure
# 1. atlas/schema.sql を編集（望ましい状態を SQL で書く。部分 index など Postgres の機能も使える）
# 2. 差分から versioned migration を生成し、出力された SQL を目で確認する
bun run db:migrate:diff add_some_column
# 3. 静的検査（atlas login が必要。§5.2）
bun run db:migrate:lint
# 4. ローカル DB に適用
bun run db:migrate:deploy
# 5. Kysely の型を再生成する（types.ts も同じコミットに含める）
bun run db:kysely:codegen
```

- `schema.sql` / 生成したマイグレーション / `atlas.sum` / `types.ts` は**同じコミットに含める**
- コミット済みのマイグレーションは書き換えない（直すときは新しいマイグレーションを追加する）
- スキーマは変えずに**データだけを直す**ときは、`atlas migrate new <名前> --dir file://atlas/migrations` で空のマイグレーションを作って SQL を書き、
  `atlas migrate hash --dir file://atlas/migrations` で `atlas.sum` を更新する。何度流しても結果が同じになる SQL にする
  （例: `20261017073537_backfill_project_publication.sql`、#262）
- `id` と `updatedAt` には DB 側の DEFAULT が無い（アプリ側で値を渡す）。新しいテーブルも同じ方針にそろえる
- テーブル・列を足したら、`schema.sql` に `COMMENT ON` で説明を書く。新しいテーブルは `.tbls.yml` の `viewpoints` のどこかに入れる。
  どちらも忘れると、CI の DB Docs ワークフローが失敗する（§6）
- `docs/db/` は PR で CI が再生成するので、手元で再生成しなくてよい（手元で確認したいときは `bun run db:docs`）

### 5.5 Prisma で作った既存 DB を Atlas 管理に切り替える（DB ごとに 1 回だけ）

ステージングなど、`prisma migrate` で作った DB は、baseline（`20261016081927`）を「適用済み」として記録する。
実際の DDL は流さない。

```bash
cd packages/infrastructure
export DATABASE_URL="<対象 DB の URL>"

# 1. ズレが無いことを確認する。「Schemas are synced」以外が出たら、ここで止めて原因を調べる
bun run db:schema:drift
# 2. baseline を適用済みとして記録する
bun run db:migrate:deploy --baseline 20261016081927
# 3. 「Migration Status: OK / Current Version: 20261016081927」になっていることを確認する
bun run db:migrate:status
```

- **Supabase では Direct 接続（`db.<project-ref>.supabase.co:5432`）か Session Pooler の URL を使う**。
  アプリ用の Transaction Pooler（ポート 6543）はマイグレーションには使わない。
  Direct 接続は IPv6 のみのため、手元のネットワークが IPv6 に対応していなければ Session Pooler を使う
- `_prisma_migrations` テーブルは残しておいて問題ない（Atlas は無視する）。不要になったら手動で削除してよい
- ローカルの開発 DB は、作り直すほうが簡単（`make db-reset` = `supabase db reset` → `bun run db:migrate:deploy`）

### 5.6 テスト / CI

- 統合テスト（`test/globalSetup.ts`）は `atlas migrate apply --env local` でスキーマを適用する。Atlas CLI が必要
- `INFRA_TEST_DATABASE_URL` で既存 DB を使う場合、その DB が Prisma で作ったものなら作り直すか、5.5 の手順で baseline を記録する
- E2E（`.github/workflows/e2e.yml`）も `bun run db:migrate:deploy` で DB を作る

---

## 6. DB ドキュメント（テーブル定義書・ER 図。tbls）

`docs/db/` のテーブル定義書と領域別の ER 図は、**tbls** で `atlas/schema.sql` から自動生成している（#261）。**手で編集しない。**

### 6.1 構成

| 役割 | 場所 |
|---|---|
| テーブル・列の説明（正本） | `atlas/schema.sql` の `COMMENT ON TABLE` / `COMMENT ON COLUMN` |
| 領域の分け方・日本語見出し・lint ルール | `packages/infrastructure/.tbls.yml` |
| 生成スクリプト | `packages/infrastructure/scripts/db-docs.ts`（`bun run db:docs`） |
| 生成物 | `docs/db/`（索引 `README.md`、テーブルごとのページ、領域別ビュー `viewpoint-*.md`、`schema.json`） |
| CI | `.github/workflows/db-docs.yml` |
| DB ドキュメントサイト（VitePress） | `apps/docs-site`（`bun run docs:build`）→ `.github/workflows/docs-site.yml` が GitHub Pages に公開（§6.5） |
| 動く ER 図（Liam ERD） | `scripts/db-erd.ts`（`bun run db:erd`）。サイトの `/er/` に入る（§6.5） |

- 説明を `COMMENT ON` に書くのは、DB 自体に意味を持たせるため。同じ説明が `docs/db/`・Supabase Studio・`types.ts` の JSDoc（kysely-codegen が出力する）の 3 か所に出る
- ER 図は Mermaid で出力する。GitHub 上でそのまま図として表示される。図には主キー・外部キーとその説明だけを載せ、全カラムは各テーブルのページで見る

### 6.2 生成のしくみ

`bun run db:docs` は次の順に動く:

1. 使い捨ての PostgreSQL を Docker で起動する（`DB_DOCS_DATABASE_URL` を指定した場合はその DB を使う。CI はこちら）
2. `atlas migrate apply` でマイグレーションを適用する
3. Atlas の適用履歴スキーマ（`atlas_schema_revisions`）を削除する（ドキュメントに混ざらないように）
4. `tbls doc` で `docs/db/` を作り直す。tbls が PATH に無ければ Docker イメージ（`ghcr.io/k1low/tbls`）で動かす
5. `schema.json` から、生成した環境で変わる値（PostgreSQL のバージョン文字列など）を取り除く。ローカルと CI で同じ結果になる
6. `tbls lint` を実行する（説明の付け忘れ・どの領域にも入っていないテーブルを検出）。違反があると、通常は警告を出すだけで、`--strict` を付けると失敗扱いになる（CI は `--strict`）

手元で動かすには **Docker と Atlas CLI** が必要。

### 6.3 CI（自動再生成）

`.github/workflows/db-docs.yml` は、`atlas/`・`.tbls.yml`・生成スクリプト・`docs/db/` を変えた PR で `bun run db:docs --strict` を実行する。
`docs/db/` に差分が出たら、`github-actions[bot]` が同じ PR に「docs: DB ドキュメント（docs/db）を再生成」をコミットする。

- lint の違反（説明の付け忘れ、どの領域にも入っていないテーブル）があると失敗する。`schema.sql` に `COMMENT ON` を足すか、`.tbls.yml` の `viewpoints` にテーブルを足す
- 自動コミットのあとに手元から push するときは、先に `git pull` する
- 自動コミットは GITHUB_TOKEN で push するため、その push では CI / E2E は再実行されない（main にはブランチ保護を設定していないので、マージは妨げられない）
- tbls のバージョンは、ワークフローの `setup-tbls`（`version`）と `scripts/db-docs.ts` の `TBLS_IMAGE` で揃える

### 6.4 説明（COMMENT ON）の書き方

各テーブル定義の直後に、テーブルと全列の説明を書く（#271）。

```sql
COMMENT ON TABLE "projects" IS 'リーダーが立ち上げるプロジェクト。公開審査（DRAFT → PENDING_REVIEW → PUBLISHED）を持つ。…';
COMMENT ON COLUMN "projects"."story" IS '本文（Markdown。最大 10000 文字。公開申請に必須）。ドメインでは body';
```

- 書く内容: 業務上の意味、値の形式・上限・単位、NULL の意味、enum の各値の意味、ドメインでの呼び名（列名と違う場合）
- 使っていない列には `【未使用】`、コードが無いテーブルには `【未実装 #番号】` を先頭に付ける
- 文字数の上限などはコード（Zod・値オブジェクト）が正本。上限を変えたら説明も直す
- 説明文にシングルクォート（`'`）は使わない（使うなら `''` と 2 つ重ねる）
- 説明を変えるだけでもスキーマの差分になる。`db:migrate:diff` でマイグレーションを作り、`types.ts` も再生成する

### 6.5 DB ドキュメントサイトと動く ER 図（GitHub Pages）

- DB ドキュメントサイト: **https://physicalfunding.github.io/PhysiFun/**（#280）
- 動く ER 図（Liam ERD）: **https://physicalfunding.github.io/PhysiFun/er/**（#273）

DB 関連のドキュメントを、[VitePress](https://vitepress.dev/) でメニュー・サイドバー・全文検索つきのサイトにまとめて公開している。
リポジトリの README の冒頭からリンクしている。

**サイトに載せる範囲（DB 関連だけ）**: `docs/db/` の Markdown、`docs/specs/02_domain-model.md`、`03_data-model.md`、サイト独自のトップページ（`apps/docs-site/pages/`）。
範囲は `apps/docs-site/scripts/prepare-content.ts` のコピー対象で決まる。変えるときは、このスクリプトと `.vitepress/config.mts` のメニュー・サイドバーを直す。

- **しくみ**: `prepare-content.ts` が載せるファイルを `apps/docs-site/.content/` に集め、VitePress がそこからビルドする。動く ER 図（`dist/erd/`）は `.content/public/er/` にコピーされ、`/er/` で配信される
- **サイドバー**: 領域別のビューとテーブルの一覧は、`docs/db/schema.json` から自動で作る（テーブルや領域を足しても設定を直さなくてよい）
- **図**: tbls の Mermaid の ER 図と、02 / 03 の状態遷移図は、`vitepress-plugin-mermaid` で描画する
- **日本語の検索**: VitePress 標準の検索は空白で単語を区切るため、日本語が引けない。`Intl.Segmenter` で単語に区切る関数を設定している。この関数は文字列にしてブラウザにも送られるので、外側の変数や import を参照しない形にしておく
- **動く ER 図**: DB 全体をズーム・検索でき、テーブルを選ぶと関係するテーブルが光り、列の説明が右側に出る。Liam ERD の CLI のバージョンは `scripts/db-erd.ts` の `LIAM_CLI` で固定している。Liam ERD 0.7.24 は tbls の `viewpoints[].id` を受け付けないので、スクリプトが取り除いてから渡す
- **公開**: `.github/workflows/docs-site.yml` が、対象のファイル（`docs/db/`・02 / 03・`apps/docs-site/`・`db-erd.ts`）が main に入るたびに作り直して公開する。PR ではビルドできるかだけを確認する。リポジトリの Settings → Pages の Source は「GitHub Actions」（設定済み）
- **手元で見る**: `bun run db:erd` のあと `bun run docs:dev`（開発サーバー）か、`bun run docs:build` → `bun run --cwd apps/docs-site preview`。動く ER 図を含めるには、先に `db:erd` が必要
- repo は public なので、サイトは誰でも見られる（中身はリポジトリにある文書と同じ）

### 6.6 既知の制約

- テーブル名に `public.` が付く（tbls の仕様。消す設定は無い）
- `.tbls.yml` の値に `#` を含めるときは引用符で囲む（YAML では `#` 以降がコメント扱いになる）

---

## 7. 残作業

- [x] `leader-application` / `account` / `admin-account` / `outbox` の Kysely 実装（#222〜#226）。
  - Outbox の claim は `FOR UPDATE SKIP LOCKED` ベースへ置換済み。
  - 一意制約判定は pg の `error.code === '23505'`（`isUniqueConstraintError` の Kysely 版、#227）。
  - NextAuth カスタム Adapter を `AdminKyselyAdapter` として再実装（#225）。
- [x] admin QueryService を application 層の Port 化（#231）。
- [x] Outbox の email ルックアップを Kysely 化し、旧 `Prisma*` 実装・Prisma 版テストヘルパーを削除。統合テスト・E2E・seed も Kysely 化（#230 前半）。
- [x] `atlas/schema.sql` と baseline を作成し、`prisma migrate` を撤去。テスト・CI のスキーマ適用を Atlas に切り替え（#228 / #229）。
- [ ] ステージング DB に baseline を記録（5.5 の手順。PR マージ後に 1 回）。
- [x] `@prisma/client` / `prisma` / `schema.prisma` / `prisma.config.ts` を削除し、`types.ts` を kysely-codegen 生成物へ一本化（#230 後半）。
