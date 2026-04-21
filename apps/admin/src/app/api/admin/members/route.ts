import { type NextRequest } from "next/server";
import { AdminAccount, AdminAccountEmail } from "@physifun/domain";
import {
  conflictResponse,
  internalErrorResponse,
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { getAuthenticatedAdminId } from "@/lib/api/auth";
import { logAdminAction } from "@/lib/api/auditLog";
import { enforceAdminRateLimit } from "@/lib/rateLimit";
import { getAdminAccountRepository } from "@/lib/di/queryServices";

/**
 * GET /api/admin/members (#148)
 *
 * 運営メンバーの一覧を返す。ACTIVE な AdminAccount のみがアクセス可能。
 */
export async function GET() {
  try {
    const operatorId = await getAuthenticatedAdminId();
    if (!operatorId) return unauthorizedResponse();

    const repo = getAdminAccountRepository();
    const members = await repo.findAll();

    return successResponse({
      items: members.map((m) => ({
        id: m.id.toString(),
        email: m.email.toString(),
        status: m.status,
        createdAt: m.createdAt.toISOString(),
        lastLoginAt: m.lastLoginAt?.toISOString() ?? null,
      })),
    });
  } catch (e) {
    console.error("[api] admin/members GET error:", e);
    return internalErrorResponse();
  }
}

/**
 * POST /api/admin/members (#148)
 *
 * 新規 AdminAccount を ACTIVE で作成する。
 * body: { email: string }
 *
 * - email は AdminAccountEmail 値オブジェクトで正規化・検証
 * - 既存 email は 409 CONFLICT
 * - 成功時は admin_account.create の AuditLog を post-hook で書き込む (#158 H4)
 */
export async function POST(request: NextRequest) {
  try {
    const operatorId = await getAuthenticatedAdminId();
    if (!operatorId) return unauthorizedResponse();

    const limited = enforceAdminRateLimit("adminAction", operatorId);
    if (limited) return limited;

    // body パース
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return validationErrorResponse("リクエストボディが不正です");
    }
    if (typeof body !== "object" || body === null) {
      return validationErrorResponse("リクエストボディが不正です");
    }
    const rawEmail = (body as { email?: unknown }).email;
    if (typeof rawEmail !== "string") {
      return validationErrorResponse("メールアドレスが必要です", {
        email: ["メールアドレスを文字列で指定してください"],
      });
    }

    // 値オブジェクトで検証・正規化
    const emailResult = AdminAccountEmail.from(rawEmail);
    if (!emailResult.ok) {
      const err = emailResult.error;
      const messages: string[] = [
        err.type === "EMAIL_REQUIRED"
          ? "メールアドレスを入力してください"
          : err.type === "EMAIL_TOO_LONG"
            ? `メールアドレスは ${err.maxLength} 文字以内で指定してください`
            : "メールアドレスの形式が正しくありません",
      ];
      return validationErrorResponse("入力内容を確認してください", { email: messages });
    }

    const repo = getAdminAccountRepository();

    // 重複チェック
    const existing = await repo.findByEmail(emailResult.value);
    if (existing) {
      return conflictResponse("このメールアドレスは既に登録されています");
    }

    const admin = AdminAccount.create({ email: emailResult.value });
    await repo.create(admin);

    // #158 H4: 監査証跡 (post-hook / 非トランザクショナル)
    await logAdminAction({
      adminAccountId: operatorId,
      action: "admin_account.create",
      targetType: "AdminAccount",
      targetId: admin.id.toString(),
      metadata: { email: admin.email.toString() },
    });

    return successResponse(
      {
        id: admin.id.toString(),
        email: admin.email.toString(),
        status: admin.status,
        createdAt: admin.createdAt.toISOString(),
        lastLoginAt: null,
      },
      201
    );
  } catch (e) {
    console.error("[api] admin/members POST error:", e);
    return internalErrorResponse();
  }
}
