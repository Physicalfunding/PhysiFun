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

---

## 2. 移行の経緯（最初に PoC として移行した `project` ドメインの例）

- `src/database/kysely/client.ts` — Kysely シングルトン（`pg` Pool、pgBouncer 互換）。
- `src/database/kysely/types.ts` — DB 型（当時は手書き。#230 で kysely-codegen の生成物に置き換えた）。
- `src/project/KyselyProjectQueryService.ts` — `PrismaProjectQueryService` と同一 API の drop-in。
- `src/project/KyselyProjectCommandAdapter.ts` — `PrismaProjectCommandAdapter` と同一 API の drop-in
  （`$transaction` 相当、count→insert の TOCTOU、Outbox 書き込みを含む）。
- `src/kysely.ts` — Kysely 実装のサブバレル（後述の ESM 事情でメイン barrel と分離）。
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

### Jest（apps/web）と ESM の事情
`kysely` は **ESM 専用**（CJS ビルド無し）。`next/jest` は node_modules を変換対象から外し、
`transpilePackages` 方式も bun の `.bun/<pkg>@<ver>/` レイアウトでは効かない。そのため
**Kysely を読み込む実装はメイン barrel（`@physifun/infrastructure`）に載せず、サブバレル
`@physifun/infrastructure/src/kysely` に隔離**している。メイン barrel には DB に依存しない実装と
型・純粋関数だけを置き、Jest テストから読まれるモジュールは Kysely を一切ロードしない
（DI を読むテストはモジュールをモックする）。`apps/admin` は `bun:test`（ESM 対応）なので制約なし。
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

- `atlas login` は不要。このプロジェクトはテーブル / enum / インデックス / 外部キーだけを使っており、
  ログインなしで使える機能で足りる（ビュー・関数・トリガー・拡張機能を使い始めたら見直す）
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
# 3. 静的検査
bun run db:migrate:lint
# 4. ローカル DB に適用
bun run db:migrate:deploy
# 5. Kysely の型を再生成する（types.ts も同じコミットに含める）
bun run db:kysely:codegen
```

- `schema.sql` / 生成したマイグレーション / `atlas.sum` / `types.ts` は**同じコミットに含める**
- コミット済みのマイグレーションは書き換えない（直すときは新しいマイグレーションを追加する）
- `id` と `updatedAt` には DB 側の DEFAULT が無い（アプリ側で値を渡す）。新しいテーブルも同じ方針にそろえる

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

## 6. 残作業

- [x] `leader-application` / `account` / `admin-account` / `outbox` の Kysely 実装（#222〜#226）。
  - Outbox の claim は `FOR UPDATE SKIP LOCKED` ベースへ置換済み。
  - 一意制約判定は pg の `error.code === '23505'`（`isUniqueConstraintError` の Kysely 版、#227）。
  - NextAuth カスタム Adapter を `AdminKyselyAdapter` として再実装（#225）。
- [x] admin QueryService を application 層の Port 化（#231）。
- [x] Outbox の email ルックアップを Kysely 化し、旧 `Prisma*` 実装・Prisma 版テストヘルパーを削除。統合テスト・E2E・seed も Kysely 化（#230 前半）。
- [x] `atlas/schema.sql` と baseline を作成し、`prisma migrate` を撤去。テスト・CI のスキーマ適用を Atlas に切り替え（#228 / #229）。
- [ ] ステージング DB に baseline を記録（5.5 の手順。PR マージ後に 1 回）。
- [x] `@prisma/client` / `prisma` / `schema.prisma` / `prisma.config.ts` を削除し、`types.ts` を kysely-codegen 生成物へ一本化（#230 後半）。
