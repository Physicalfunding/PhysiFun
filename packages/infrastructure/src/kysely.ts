/**
 * Kysely 実装のサブバレル（PoC: project ドメイン移行）
 *
 * ## なぜメインの `index.ts` と分けるのか
 * `kysely` は ESM 専用パッケージ（`type: module`、CJS ビルド無し）。一方 apps/web の
 * ユニットテストは Jest (CommonJS) で動き、`next/jest` の `transformIgnorePatterns` は
 * node_modules を変換対象から外す（しかも bun の `.bun/<pkg>@<ver>/` レイアウトのため
 * `transpilePackages` 方式も効かない）。
 *
 * そこで Kysely を読み込む実装は、全所から import されるメイン barrel には載せず、
 * このサブバレルに隔離する。Kysely を使う DI（project ドメイン）だけがここを import し、
 * Prisma ベースの DI / それを読む Jest テストは Kysely を一切ロードしない。
 *
 * 利用側:
 *   import { KyselyProjectQueryService } from "@physifun/infrastructure/src/kysely";
 */
export { db as kyselyDb, kyselyPool } from "./database/kysely/client";
export type { DB as KyselyDB } from "./database/kysely/types";
export { KyselyProjectQueryService } from "./project/KyselyProjectQueryService";
export { KyselyProjectCommandAdapter } from "./project/KyselyProjectCommandAdapter";
