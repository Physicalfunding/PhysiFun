import { type NextRequest } from "next/server";
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  internalErrorResponse,
} from "@/lib/api/response";
import { getLeaderApplicationQueryService } from "@/lib/di/queryServices";
import { getAuthenticatedAdminId } from "@/lib/api/auth";

const VALID_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
type Status = (typeof VALID_STATUSES)[number];

/**
 * GET /api/admin/applications
 *
 * リーダー応募の一覧を返す。ADMIN ロール必須。
 *
 * 認証の注意:
 * - middleware.ts は /api パスを除外しているため、この Route Handler が唯一の認可チェック
 * - 運営認証は `@/lib/api/auth#getAuthenticatedAdminId` で AdminSession 経由の Database 戦略 (#145)
 *
 * クエリパラメータ:
 * - status: "PENDING" | "APPROVED" | "REJECTED" (省略時: 全件)
 * - page: number (デフォルト 1)
 * - perPage: number (デフォルト 20, 上限 100)
 */
export async function GET(request: NextRequest) {
  try {
    // 運営認証は `@/lib/api/auth#getAuthenticatedAdminId` で AdminSession 経由の Database 戦略 (#145)
    const reviewerId = await getAuthenticatedAdminId();
    if (!reviewerId) return unauthorizedResponse();

    // クエリパラメータ
    const { searchParams } = request.nextUrl;
    const statusParam = searchParams.get("status");
    const pageParam = searchParams.get("page");
    const perPageParam = searchParams.get("perPage");

    // status バリデーション
    let status: Status | undefined;
    if (statusParam) {
      if (!VALID_STATUSES.includes(statusParam as Status)) {
        return validationErrorResponse("無効なステータスです", {
          status: [`${VALID_STATUSES.join(", ")} のいずれかを指定してください`],
        });
      }
      status = statusParam as Status;
    }

    // ページネーション
    const page = Math.max(1, Number(pageParam) || 1);
    const perPage = Math.min(100, Math.max(1, Number(perPageParam) || 20));

    const queryService = getLeaderApplicationQueryService();
    const result = await queryService.findMany({ status, page, perPage });

    return successResponse({
      items: result.items.map((item) => ({
        ...item,
        submittedAt: item.submittedAt.toISOString(),
        reviewedAt: item.reviewedAt?.toISOString() ?? null,
      })),
      totalCount: result.totalCount,
      page,
      perPage,
    });
  } catch (e) {
    console.error("[api] admin/applications GET error:", e);
    return internalErrorResponse();
  }
}
