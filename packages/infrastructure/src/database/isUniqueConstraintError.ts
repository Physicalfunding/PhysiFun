import { Prisma } from "@prisma/client";

/**
 * Prisma の一意制約違反 (P2002) を型安全に判定するユーティリティ (#148 / PR #164 H-1)
 *
 * ## 背景
 * Route Handler では `@prisma/client` の runtime クラス
 * (`Prisma.PrismaClientKnownRequestError`) を直接参照しないのが本リポジトリの
 * レイヤリングルール (Prisma/Supabase は infrastructure/ に隠蔽)。
 * 一方で POST /api/admin/members のように
 *   - 事前 findByEmail で重複チェック
 *   - レース条件で DB の unique index に弾かれる可能性
 * という二段構えのエラー分岐が必要なケースは、`instanceof` 判定を infra 側に
 * 閉じて Route からは型ガード関数だけを使えるようにしておく。
 */
export function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}
