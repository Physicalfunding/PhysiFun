import { Prisma } from "@prisma/client";
import { prisma } from "../database/client";

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
 * 運営操作の AdminAuditLog 行を作成する (#157 H2 対応)
 *
 * ## 非トランザクショナルな設計判断
 * - Route Handler 側で UseCase 成功後に post-hook として呼び出す想定。
 * - UseCase のドメイントランザクションには参加させない (入力を port 経由で受けていないため、
 *   UseCase の純度を保つ判断。)
 * - 「UseCase は成功したが AuditLog 書き込みが失敗した」ケースでは呼び出し側で
 *   log-and-continue する想定。将来 UseCase 内の transaction に組み込む選択肢は残す。
 *
 * エラーは throw する (呼び出し側が swallow するかどうか判断できるように)。
 */
export async function writeAdminAuditLog(params: WriteAdminAuditLogParams): Promise<void> {
  await prisma.adminAuditLog.create({
    data: {
      adminAccountId: params.adminAccountId,
      adminSessionId: params.adminSessionId ?? null,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId ?? null,
      // Prisma の Json カラムに DB NULL を入れる場合は Prisma.JsonNull を使う。
      metadata:
        params.metadata == null
          ? Prisma.JsonNull
          : (params.metadata as Prisma.InputJsonValue),
    },
  });
}
