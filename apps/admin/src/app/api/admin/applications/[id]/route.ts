import { type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { PrismaLeaderApplicationQueryService } from "@physifun/infrastructure";
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  internalErrorResponse,
} from "@/lib/api/response";

const queryService = new PrismaLeaderApplicationQueryService();

/**
 * GET /api/admin/applications/:id
 *
 * リーダー応募の詳細を返す。ADMIN ロール必須。
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // ADMIN ロールチェック
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return unauthorizedResponse();
    const roles = (token.roles as string[] | undefined) ?? [];
    if (!roles.includes("ADMIN")) return unauthorizedResponse("ADMIN 権限が必要です");

    const { id } = await params;
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
