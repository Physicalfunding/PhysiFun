import { AdminAccountId } from "@physifun/domain";
import { disableAdminAccountAndRevokeSessions } from "@physifun/infrastructure";
import {
  forbiddenResponse,
  internalErrorResponse,
  notFoundResponse,
  successResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { getAuthenticatedAdminId } from "@/lib/api/auth";
import { logAdminAction } from "@/lib/api/auditLog";
import { enforceAdminRateLimit } from "@/lib/rateLimit";
import { getAdminAccountRepository } from "@/lib/di/queryServices";

/**
 * POST /api/admin/members/:id/disable (#148)
 *
 * 指定 AdminAccount を DISABLED に遷移させ、AdminSession を全件削除して強制 revoke する。
 *
 * - 自分自身の無効化は 403 (集約内ガード `CANNOT_DISABLE_SELF`)
 * - 既に DISABLED なら 422 (`CANNOT_DISABLE_ALREADY_DISABLED`)
 * - 成功時は admin_account.disable + admin_session.revoke の 2 行を AuditLog に書く (#158 H4)
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const operatorId = await getAuthenticatedAdminId();
    if (!operatorId) return unauthorizedResponse();

    const limited = enforceAdminRateLimit("adminAction", operatorId);
    if (limited) return limited;

    const { id } = await params;

    const idResult = AdminAccountId.from(id);
    if (!idResult.ok) {
      return validationErrorResponse("無効なメンバー ID です", {
        id: ["UUID v4 形式で指定してください"],
      });
    }

    // 操作者 ID も値オブジェクトに包む (集約に operatorId を渡すため)
    const operatorIdResult = AdminAccountId.from(operatorId);
    if (!operatorIdResult.ok) {
      // セッション上の id は adapter が検証済みのはず。これは防御的に 500。
      return internalErrorResponse();
    }

    const repo = getAdminAccountRepository();
    const target = await repo.findById(idResult.value);
    if (!target) return notFoundResponse("メンバー");

    const disableResult = target.disable({ operatorId: operatorIdResult.value });
    if (!disableResult.ok) {
      switch (disableResult.error.type) {
        case "CANNOT_DISABLE_SELF":
          return forbiddenResponse("自分自身は無効化できません");
        case "CANNOT_DISABLE_ALREADY_DISABLED":
          return unprocessableEntityResponse("このメンバーは既に無効化されています");
      }
    }

    // PR #164 Blocker B-1: DISABLED 永続化と AdminSession 削除を単一トランザクションで実行。
    // 途中失敗で「DB は DISABLED なのにセッションだけ残る」整合性崩れを防ぐ。
    const { revokedSessionCount } = await disableAdminAccountAndRevokeSessions(target);

    // #158 H4: 2 行の監査証跡を書く (disable + session.revoke を分けて残す)
    // 監査ログは post-hook（非トランザクショナル）。commit 後に書くのは意図的。
    await logAdminAction({
      adminAccountId: operatorId,
      action: "admin_account.disable",
      targetType: "AdminAccount",
      targetId: target.id.toString(),
      metadata: { email: target.email.toString() },
    });
    await logAdminAction({
      adminAccountId: operatorId,
      action: "admin_session.revoke",
      targetType: "AdminAccount",
      targetId: target.id.toString(),
      metadata: { revokedSessionCount, reason: "admin_account.disable" },
    });

    return successResponse({
      id: target.id.toString(),
      status: target.status,
      revokedSessionCount,
    });
  } catch (e) {
    console.error("[api] admin/members/[id]/disable POST error:", e);
    return internalErrorResponse();
  }
}
