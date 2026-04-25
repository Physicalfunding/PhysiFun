import { type NextRequest } from "next/server";
import { AdminAccount } from "@physifun/domain";
import { isUniqueConstraintError } from "@physifun/infrastructure";
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
 * GET /api/admin/members (#148 / #167 ページネーション対応)
 *
 * 運営メンバーの一覧を返す。ACTIVE な AdminAccount のみがアクセス可能。
 *
 * クエリパラメータ:
 * - page: number (デフォルト 1)
 * - perPage: number (デフォルト 20, 上限 50)
 */
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 50;

export async function GET(request: NextRequest) {
  try {
    const operatorId = await getAuthenticatedAdminId();
    if (!operatorId) return unauthorizedResponse();

    // #166: 認証済みでの大量スクレイピング抑止のため、GET にもレート制限を適用
    const limited = enforceAdminRateLimit("adminRead", operatorId);
    if (limited) return limited;

    const { searchParams } = request.nextUrl;
    const pageParam = searchParams.get("page");
    const perPageParam = searchParams.get("perPage");

    const page = Math.max(1, Number(pageParam) || 1);
    const perPage = Math.min(
      MAX_PER_PAGE,
      Math.max(1, Number(perPageParam) || DEFAULT_PER_PAGE)
    );

    const repo = getAdminAccountRepository();
    const result = await repo.findAll({ page, perPage });

    return successResponse({
      items: result.items.map((m) => ({
        id: m.id.toString(),
        email: m.email.toString(),
        status: m.status,
        createdAt: m.createdAt.toISOString(),
        lastLoginAt: m.lastLoginAt?.toISOString() ?? null,
      })),
      totalCount: result.totalCount,
      page,
      perPage,
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

    // PR #164 m-2: email 検証と集約生成を一発でまとめる (createFromRawEmail)。
    // 集約側が AdminAccountEmail を隠蔽するため、Route Handler は値オブジェクトを
    // 組み立てる責務から解放される。
    const adminResult = AdminAccount.createFromRawEmail({ email: rawEmail });
    if (!adminResult.ok) {
      const err = adminResult.error;
      const messages: string[] = [
        err.type === "EMAIL_REQUIRED"
          ? "メールアドレスを入力してください"
          : err.type === "EMAIL_TOO_LONG"
            ? `メールアドレスは ${err.maxLength} 文字以内で指定してください`
            : "メールアドレスの形式が正しくありません",
      ];
      return validationErrorResponse("入力内容を確認してください", { email: messages });
    }
    const admin = adminResult.value;

    const repo = getAdminAccountRepository();

    // 重複チェック (集約生成後に email 値オブジェクトで findByEmail する)
    // PR #164 M-1: DISABLED な同一 email アカウントが既にある場合は「再有効化してね」と案内し、
    // ACTIVE な場合は「既に登録済み」とメッセージを分岐させる。
    const existing = await repo.findByEmail(admin.email);
    if (existing) {
      if (existing.isDisabled()) {
        return conflictResponse(
          "このメールアドレスのメンバーは現在無効化中です。再有効化してください"
        );
      }
      return conflictResponse("このメールアドレスのメンバーは既に登録されています");
    }

    // PR #164 H-1: findByEmail と create の間のレース条件で DB 側 unique index (P2002) に
    // 弾かれる可能性があるため、Prisma の一意制約違反を 409 Conflict として透過的に返す。
    // Prisma runtime 値は infra 層に閉じた `isUniqueConstraintError` ヘルパーで判定する。
    try {
      await repo.create(admin);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        return conflictResponse("このメールアドレスのメンバーは既に登録されています");
      }
      throw err;
    }

    // #158 H4: 監査証跡 (post-hook / 非トランザクショナル)
    void logAdminAction({
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
