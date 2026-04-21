import { AdminAccountId } from "@physifun/domain";
import {
  internalErrorResponse,
  notFoundResponse,
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { getAuthenticatedAdminId } from "@/lib/api/auth";
import { logAdminAction } from "@/lib/api/auditLog";
import { enforceAdminRateLimit } from "@/lib/rateLimit";
import { getAdminAccountRepository } from "@/lib/di/queryServices";

/**
 * POST /api/admin/members/:id/enable (#148)
 *
 * DISABLED な AdminAccount を再有効化する。
 *
 * - 既に ACTIVE でも冪等 (集約 enable() は void)
 * - 成功時 admin_account.enable を AuditLog に書く (#158 H4)
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

    const repo = getAdminAccountRepository();
    const target = await repo.findById(idResult.value);
    if (!target) return notFoundResponse("メンバー");

    target.enable();
    await repo.update(target);

    await logAdminAction({
      adminAccountId: operatorId,
      action: "admin_account.enable",
      targetType: "AdminAccount",
      targetId: target.id.toString(),
      metadata: { email: target.email.toString() },
    });

    return successResponse({
      id: target.id.toString(),
      status: target.status,
    });
  } catch (e) {
    console.error("[api] admin/members/[id]/enable POST error:", e);
    return internalErrorResponse();
  }
}
