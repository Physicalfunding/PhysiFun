import { type NextRequest } from "next/server";
import { isUuidV4 } from "@physifun/domain";
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  validationErrorResponse,
  internalErrorResponse,
} from "@/lib/api/response";
import { getLeaderApplicationQueryService } from "@/lib/di/queryServices";
import { getAuthenticatedAdminId } from "@/lib/api/auth";

/**
 * GET /api/admin/applications/:id
 *
 * リーダー応募の詳細を返す。ADMIN ロール必須。
 *
 * 認証の注意:
 * - middleware.ts は /api パスを除外しているため、この Route Handler が唯一の認可チェック
 * - 運営認証は `@/lib/api/auth#getAuthenticatedAdminId` で AdminSession 経由の Database 戦略 (#145)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // 運営認証は `@/lib/api/auth#getAuthenticatedAdminId` で AdminSession 経由の Database 戦略 (#145)
    const reviewerId = await getAuthenticatedAdminId();
    if (!reviewerId) return unauthorizedResponse();

    const { id } = await params;

    // UUID 形式バリデーション
    if (!isUuidV4(id)) {
      return validationErrorResponse("無効な応募 ID です", {
        id: ["UUID v4 形式で指定してください"],
      });
    }

    const queryService = getLeaderApplicationQueryService();
    const detail = await queryService.findById(id);

    if (!detail) {
      return notFoundResponse("応募");
    }

    return successResponse({
      ...detail,
      submittedAt: detail.submittedAt.toISOString(),
      reviewedAt: detail.reviewedAt?.toISOString() ?? null,
    });
  } catch (e) {
    console.error("[api] admin/applications/[id] GET error:", e);
    return internalErrorResponse();
  }
}
