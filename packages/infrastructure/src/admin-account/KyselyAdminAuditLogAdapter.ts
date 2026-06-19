import { randomUUID } from "node:crypto";
import { db } from "../database/kysely/client";

/**
 * AdminAuditLog 書き込み用パラメータ (#145 / #157 H2)
 */
export interface WriteAdminAuditLogParams {
  /** 操作した運営 AdminAccount.id */
  readonly adminAccountId: string;
  /** 紐づく AdminSession.id (取得可能なら)。Session 行失効後も履歴を残すため nullable */
  readonly adminSessionId?: string | null;
  /** アクション識別子。"leader_application.approve" 等のドット区切り */
  readonly action: string;
  /** 対象エンティティの種別名 ("LeaderApplication" / "Project" 等) */
  readonly targetType: string;
  /** 対象エンティティの ID。任意操作は null */
  readonly targetId?: string | null;
  /** アクション固有のペイロード (note 等)。JSON 直列化可能であること。null/undefined で DB NULL */
  readonly metadata?: unknown;
}

/**
 * 運営操作の AdminAuditLog 行を作成する（Prisma 版からの移行 / #224）
 *
 * `PrismaAdminAuditLogAdapter#writeAdminAuditLog` と同一 API の drop-in。
 *
 * NOTE: `id` は Prisma の `@default(uuid())`（クライアント側生成・DB DEFAULT 無し）相当のため、
 * ここで明示的に UUID を採番する。`createdAt` は DB DEFAULT(now()) があるため省略する。
 * エラーは throw する（呼び出し側が swallow するか判断できるように）。
 */
export async function writeAdminAuditLog(params: WriteAdminAuditLogParams): Promise<void> {
  await db
    .insertInto("admin_audit_logs")
    .values({
      id: randomUUID(),
      adminAccountId: params.adminAccountId,
      adminSessionId: params.adminSessionId ?? null,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId ?? null,
      // jsonb: オブジェクトは pg が直列化する。null は SQL NULL（読み取りは JS null で等価）。
      metadata: params.metadata == null ? null : (params.metadata as Record<string, unknown>),
    })
    .execute();
}
