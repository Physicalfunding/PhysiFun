# DB 層移行ガイド: Prisma → Kysely + Atlas（B 案）

クエリ層を **Kysely**（SQL ライクな型安全クエリビルダ）へ、スキーマ/マイグレーション管理を
**Atlas**（宣言的＋ versioned）へ段階移行するための方針と手順。型生成は **kysely-codegen** を併用する。

> ステータス: **PoC（`project` ドメインのみ移行済み）**。他ドメインは Prisma のまま共存。

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

### 5.2 既存 DB からのブートストラップ（baseline）
Prisma が作った現行スキーマを Atlas の世界へ引き継ぐ:

```bash
cd packages/infrastructure

# 1. 現行 DB の状態を宣言的ソースとして取り込む
bun run db:atlas:inspect > atlas/schema.sql

# 2. baseline migration を生成（schema.sql ⇔ 空の migration dir の差分）
atlas migrate diff baseline --env local

# 3. 既存 DB には baseline を「適用済み」として記録（実 DDL は流さない）
atlas migrate apply --env local --baseline <生成された baseline のバージョン>
```

以降、`prisma migrate` は使わず Atlas に一本化する。

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

- [ ] `leader-application` / `account` / `admin-account` / `outbox` の Kysely 実装。
  - Outbox の claim は `FOR UPDATE SKIP LOCKED` ベースへ置換すると、現状の緩い型付け
    （`Record<string, unknown>`）と擬似ロックを同時に改善できる。
  - 一意制約判定は pg の `error.code === '23505'`（`isUniqueConstraintError` の Kysely 版）。
  - NextAuth カスタム Adapter（`AdminPrismaAdapter`）の Kysely 再実装。
- [ ] `atlas/schema.sql` の baseline 確立 → `prisma migrate` 撤去 → `test/globalSetup.ts` 差し替え。
- [ ] 全ドメイン移行後に `@prisma/client` / `prisma` を依存から削除し、`types.ts` を
      kysely-codegen 生成物へ一本化。
- [ ] `.docs/tech.md` / `.docs/structure.md` の「Prisma」記述を更新。
