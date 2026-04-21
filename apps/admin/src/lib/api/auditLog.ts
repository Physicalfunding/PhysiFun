import { writeAdminAuditLog, type WriteAdminAuditLogParams } from "@physifun/infrastructure";

/**
 * Route Handler 用 AdminAuditLog 書き込みヘルパー (#145 / #157 H2)
 *
 * UseCase が成功した直後に呼び出す post-hook として用いる。
 *
 * ## 非トランザクショナルな割り切り
 * UseCase のドメイントランザクションとは独立して書き込むため、
 * 「UseCase は成功したが AuditLog 書き込みが失敗した」ケースでは
 * ここで log-and-continue する (レスポンスには影響させない)。
 *
 * 将来、監査ログが法的に必須になったら UseCase 内 transaction に
 * 組み込む (port / adapter 経由) 設計に切替する余地を残している。
 */
export async function logAdminAction(params: WriteAdminAuditLogParams): Promise<void> {
  try {
    await writeAdminAuditLog(params);
  } catch (e) {
    // 書き込み失敗でも運営オペ自体は成功扱いにする。
    // 将来トランザクション化する際に挙動を見直す (#157 H2 コメント参照)。
    console.error("[admin-audit] failed to write AdminAuditLog:", e, params);
  }
}
