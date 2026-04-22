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
 * - PR #164 Major M-1: 既に ACTIVE の場合は no-op とし、audit log も書かない。
 *   (実際の状態変化が無いのに `admin_account.enable` が積まれて監査ログが
 *    ノイズで埋まるのを防ぐ)
 * - 実際に DISABLED→ACTIVE に遷移したときのみ admin_account.enable を
 *   AuditLog に書く (#158 H4)
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

    // PR #164 M-1: 既に ACTIVE なら no-op で早期 return し、audit log を書かない。
    // 集約 enable() も冪等だが、ここで分岐することで DB update も省略できる。
    if (target.isActive()) {
      return successResponse({
        id: target.id.toString(),
        status: target.status,
      });
    }

    target.enable();
    await repo.update(target);

    // PR #164 M-2: outbox 側と揃えて fire-and-forget で呼ぶ (logAdminAction は
    // 内部で try/catch + log-and-continue する設計)。
    void logAdminAction({
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
