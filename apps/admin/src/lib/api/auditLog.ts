import {
  writeAdminAuditLog,
  type WriteAdminAuditLogParams,
} from "@physifun/infrastructure/src/kysely";

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
    //
    // #158 L2: Error オブジェクトを直接渡すことで stack trace を残す
    // (エラー直列化形式によっては文字列化で stack が落ちるため、Vercel Functions の
    //  デフォルト stdout transport で stack を出せるよう本体を 2 引数目に置く)。
    const message = "[admin-audit] failed to write AdminAuditLog";
    if (e instanceof Error) {
      console.error(message, {
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId ?? null,
        adminAccountId: params.adminAccountId,
        error: { name: e.name, message: e.message, stack: e.stack },
      });
    } else {
      // #159 Nit-1: 循環参照や非直列化オブジェクトでも壊れないよう String(e) に寄せる。
      // 非 Error ブランチに落ちるケースは throw "string" / throw null 等の異常系のみ。
      console.error(message, {
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId ?? null,
        adminAccountId: params.adminAccountId,
        error: String(e),
      });
    }
  }
}
