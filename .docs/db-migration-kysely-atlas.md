# DB 層移行ガイド: Prisma → Kysely + Atlas（B 案）

クエリ層を **Kysely**（SQL ライクな型安全クエリビルダ）へ、スキーマ/マイグレーション管理を
**Atlas**（宣言的＋ versioned）へ段階移行するための方針と手順。型生成は **kysely-codegen** を併用する。

> ステータス: **クエリ層の主要ドメイン（`project` / `leader-application` / `account` / `admin-account` / `outbox` ＋ NextAuth カスタム Adapter）を Kysely 化済み**（#222–#227）。スキーマ管理の Atlas baseline 確立（#228）以降は未着手で、Prisma が引き続きスキーマ定義（`schema.prisma`）・マイグレーションの正。

---

## 1. 全体方針

| 役割 | 旧 | 新 |
|---|---|---|
| クエリ/コマンド | Prisma Client | **Kysely**（`pg` ドライバ） |
| スキーマ管理 | `schema.prisma` | **`atlas/schema.sql`**（宣言的ソース） |
| マイグレーション | `prisma migrate` | **Atlas**（`atlas migrate diff/apply`、versioned） |
| 型生成 | `prisma generate` | **kysely-codegen**（DB から introspect） |

段階移行のため、**Prisma と Kysely を共存**させる。ドメインごとにリポジトリ実装を
Kysely に置き換え、最終的に全ドメイン移行完了後に Prisma を撤去する。

---

## 2. PoC で実装済みの内容（`project` ドメイン）

- `src/database/kysely/client.ts` — Kysely シングルトン（`pg` Pool、pgBouncer 互換）。
- `src/database/kysely/types.ts` — DB 型（**kysely-codegen 出力の手書きスタンドイン**）。
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
- **kysely 0.29 は Node >= 22 を要求**（`engines`）。本番/CI を Node 20 で固定する場合は
  kysely 0.28 系を検討（bun ローカルでは問題なし）。

### Jest（apps/web）と ESM の事情
`kysely` は **ESM 専用**（CJS ビルド無し）。`next/jest` は node_modules を変換対象から外し、
`transpilePackages` 方式も bun の `.bun/<pkg>@<ver>/` レイアウトでは効かない。そのため
**Kysely を読み込む実装はメイン barrel（`@physifun/infrastructure`）に載せず、サブバレル
`@physifun/infrastructure/src/kysely` に隔離**している。Prisma ベースの DI とそれを読む Jest
テストは Kysely を一切ロードしない。`apps/admin` は `bun:test`（ESM 対応）なので制約なし。

---

## 4. kysely-codegen（型生成）

`types.ts` は手書きスタンドイン。実 DB から型を生成して照合・更新する:

```bash
# DATABASE_URL を対象 DB に向けて実行
bun run db:kysely:codegen   # → src/database/kysely/types.generated.ts
```

> 注: kysely-codegen は NULL 許容カラムを `T | null`（INSERT 必須）で出力する。本 PoC の
> `types.ts` は Prisma の「省略カラム = NULL」挙動に合わせ、NULL 許容かつ DEFAULT 無しの
> カラムを **INSERT 省略可能**にしている（`Nullable<T>` ヘルパ）。生成物をそのまま採用する
> 場合は、省略している INSERT 値に明示 `null` を渡すか、生成後に同等の後処理を入れる。

---

## 5. Atlas（スキーマ/マイグレーション管理）

設定は `packages/infrastructure/atlas.hcl`（env `local`）。望ましいスキーマは
`atlas/schema.sql`、生成物は `atlas/migrations/`。

### 5.1 セットアップ
```bash
# Atlas CLI（Go バイナリ）
curl -sSf https://atlasgo.sh | sh
# 環境変数
export DATABASE_URL="postgresql://...";   # 適用先
export ATLAS_DEV_URL="docker://postgres/16/dev";  # 任意（未設定でも atlas.hcl の既定で Docker 起動）
```

### 5.2 既存 DB からの baseline 確立（#228）

Prisma が作った現行スキーマを Atlas の versioned migration へ「適用済み」として引き継ぐ手順。
**実 DDL は一切流さず**、Atlas の revision 追跡（`atlas_schema_revisions`）に baseline を記録するだけ。

#### 前提
- `atlas` CLI が PATH にある（§5.1）。
- **Docker が起動している**（`ATLAS_DEV_URL` 未設定時、atlas が差分計算用の使い捨て dev DB を
  `docker://postgres/16` で自動起動・破棄するため）。
- `DATABASE_URL` が baseline 対象 DB を指す。本番をベースライン化するなら本番接続文字列
  （`schema inspect` は読み取りのみで安全）。
- **まずはドライラン推奨**: ローカルで `docker run -e POSTGRES_PASSWORD=pw -p 5432:5432 -d postgres:16`
  を起動し `DATABASE_URL` をそこへ向け、`bun --cwd packages/infrastructure run db:migrate:deploy`
  （= `prisma migrate deploy`）で現行スキーマを再現してから下記を試すと安全。

#### 手順
```bash
cd packages/infrastructure

# 1. 現行 DB の状態を宣言的ソース atlas/schema.sql に取り込む
#    （bun run 経由はスクリプトのエコー行が混入し得るので atlas を直接呼ぶ）
atlas schema inspect --env local --url "$DATABASE_URL" --format '{{ sql . }}' > atlas/schema.sql

# 2. schema.sql ⇔ 空の migration dir の差分から baseline migration を生成
#    （atlas/migrations/<version>_baseline.sql と atlas.sum が生成される。dev DB に Docker を使用）
atlas migrate diff baseline --env local

# 3. 生成された baseline の version（ファイル名の数値プレフィックス）を確認
ls atlas/migrations/      # 例: 20260620090000_baseline.sql → version = 20260620090000

# 4. 既存 DB に baseline を「適用済み」として記録（実 DDL は流さない）
atlas migrate apply --env local --baseline 20260620090000
```

#### 検証（DoD）
```bash
atlas migrate status --env local        # baseline が Applied と表示される（= bun run db:atlas:status）
atlas migrate diff verify --env local   # "no changes" で migration ファイルが作られない＝現行スキーマと一致
```
`status` が baseline を Applied と示し、`diff` が新規ファイルを生成しなければ DoD 達成。
手順 4 のあと `diff` が差分を出す場合は `schema.sql` と DB が食い違っているので内容を確認する
（生成された不要ファイルは削除）。

> 部分 unique index（`WHERE status='PENDING'`）等、Prisma で諦めていた定義はこの段階で
> `schema.sql` に取り込める（§5.3）。以降 `prisma migrate` は使わず Atlas に一本化（#229）。
> 各フラグの正確な挙動は Atlas 公式ドキュメント（atlasgo.io）も参照のこと。

### 5.3 日々のスキーマ変更フロー
```bash
# 1. atlas/schema.sql を編集（望ましい状態を SQL で記述。部分 index など Postgres 機能も自由）
# 2. 差分から versioned migration を生成
bun run db:atlas:diff add_partial_unique_index   # = atlas migrate diff add_partial_unique_index --env local
# 3. 破壊的変更などの静的検査
bun run db:atlas:lint
# 4. 適用
bun run db:atlas:apply
# 5. 型を再生成して整合
bun run db:kysely:codegen
```

> Prisma で諦めていた **部分 unique index（`WHERE status='PENDING'`）** 等もここで正式に
> `schema.sql` に取り込める。

### 5.4 テスト基盤の差し替え（移行完了後）
`test/globalSetup.ts` は現状 `prisma migrate deploy` でスキーマ適用している。Atlas へ移行後は
`atlas migrate apply --env local`（または `atlas schema apply`）に置き換える。

---

## 6. 残作業（今後のドメイン移行）

- [x] `project`（PoC）/ `leader-application`（#222）/ `account`（#223）/ `admin-account`（#224）/
      `outbox`（#226）の Kysely 実装。Outbox の claim は `FOR UPDATE SKIP LOCKED` ベースへ置換済み。
- [x] 一意制約判定の pg 版 `isUniqueConstraintError`（`error.code === '23505'`、#227）。
- [x] NextAuth カスタム Adapter の Kysely 再実装（`createAdminKyselyAdapter`、#225）。
- [ ] **`atlas/schema.sql` の baseline 確立（#228、§5.2 の runbook 参照）** ← 次のステップ。
      Docker + Atlas CLI + 対象 DB が必要。
- [ ] `prisma migrate` 撤去 → `test/globalSetup.ts` を Atlas へ差し替え（#229）。
- [ ] 全ドメイン移行後に `@prisma/client` / `prisma` を依存から削除し、`types.ts` を
      kysely-codegen 生成物へ一本化（#230）。
- [ ] `.docs/tech.md` / `.docs/structure.md` の「Prisma」記述を更新。
