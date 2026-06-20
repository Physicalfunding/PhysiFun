import { DatabaseError } from "pg";

/**
 * 一意制約違反を型安全に判定するユーティリティ
 * (#148 / PR #164 H-1 で Prisma 版を導入 → #227 で Kysely/pg 版へ置換)
 *
 * ## 背景
 * Route Handler では DB ドライバの runtime クラスを直接参照しないのが本リポジトリの
 * レイヤリングルール (Prisma / pg は infrastructure/ に隠蔽)。
 * 一方で POST /api/admin/members のように
 *   - 事前 findByEmail で重複チェック
 *   - レース条件で DB の unique index に弾かれる可能性
 * という二段構えのエラー分岐が必要なケースは、ドライバ固有のエラー判定を infra 側に
 * 閉じて Route からは型ガード関数だけを使えるようにしておく。
 *
 * ## Prisma → Kysely 移行 (#224 / #227)
 * AdminAccount リポジトリが Kysely (node-postgres) 実装へ移行したため、INSERT の一意制約
 * 違反は Prisma の `P2002` ではなく pg の `DatabaseError` (SQLSTATE `23505`) として送出される。
 * Kysely はドライバのエラーをラップせず素通しするため、ここでは pg の `DatabaseError` を
 * `instanceof` で判定する (素の Error に `code` を偽装したケースは弾く)。
 */
export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof DatabaseError && error.code === "23505";
}
