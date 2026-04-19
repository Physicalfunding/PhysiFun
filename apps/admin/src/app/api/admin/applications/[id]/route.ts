import { type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { PrismaLeaderApplicationQueryService } from "@physifun/infrastructure";
import { isUuidV4 } from "@physifun/domain";
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  validationErrorResponse,
  internalErrorResponse,
} from "@/lib/api/response";

const queryService = new PrismaLeaderApplicationQueryService();

/**
 * GET /api/admin/applications/:id
 *
 * リーダー応募の詳細を返す。ADMIN ロール必須。
 *
 * 認証の注意:
 * - middleware.ts は /api パスを除外しているため、この Route Handler が唯一の認可チェック
 * - token.roles は auth.ts の jwt コールバックで設定される（TODO: #61 で実装予定）
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // ADMIN ロールチェック
    // NOTE: token.roles は auth.ts の jwt コールバックで設定される（#61 で実装予定）
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return unauthorizedResponse();
    const roles = (token.roles as string[] | undefined) ?? [];
    if (!roles.includes("ADMIN")) return unauthorizedResponse("ADMIN 権限が必要です");

    const { id } = await params;

    // UUID 形式バリデーション
    if (!isUuidV4(id)) {
      return validationErrorResponse("無効な応募 ID です", {
        id: ["UUID v4 形式で指定してください"],
      });
    }

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
