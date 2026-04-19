import { type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  internalErrorResponse,
} from "@/lib/api/response";
import {
  isValidSource,
  queryOutboxItems,
  type OutboxSource,
  type OutboxStatus,
} from "@/lib/outbox";

const VALID_STATUSES: readonly OutboxStatus[] = ["pending", "retrying", "dead-lettered", "sent"];

/**
 * GET /api/admin/outbox
 *
 * Outbox メッセージの一覧を返す。ADMIN ロール必須。
 *
 * クエリパラメータ:
 * - source: "leaderApplication" | "project" (必須)
 * - status: "pending" | "retrying" | "dead-lettered" | "sent" (省略時: 未完了のみ)
 * - page: number (デフォルト 1)
 * - perPage: number (デフォルト 20, 上限 100)
 */
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return unauthorizedResponse();
    const roles = (token.roles as string[] | undefined) ?? [];
    if (!roles.includes("ADMIN")) return unauthorizedResponse("ADMIN 権限が必要です");

    const { searchParams } = request.nextUrl;
    const sourceParam = searchParams.get("source");
    const statusParam = searchParams.get("status");
    const pageParam = searchParams.get("page");
    const perPageParam = searchParams.get("perPage");

    // source バリデーション（必須）
    if (!sourceParam || !isValidSource(sourceParam)) {
      return validationErrorResponse("source パラメータが必要です", {
        source: ["leaderApplication, project のいずれかを指定してください"],
      });
    }
    const source: OutboxSource = sourceParam;

    // status バリデーション
    let status: OutboxStatus | undefined;
    if (statusParam) {
      if (!VALID_STATUSES.includes(statusParam as OutboxStatus)) {
        return validationErrorResponse("無効なステータスです", {
          status: [`${VALID_STATUSES.join(", ")} のいずれかを指定してください`],
        });
      }
      status = statusParam as OutboxStatus;
    }

    const page = Math.max(1, Number(pageParam) || 1);
    const perPage = Math.min(100, Math.max(1, Number(perPageParam) || 20));

    const result = await queryOutboxItems(source, { status, page, perPage });

    return successResponse({
      items: result.items,
      totalCount: result.totalCount,
      page,
      perPage,
    });
  } catch (e) {
    console.error("[api] admin/outbox GET error:", e);
    return internalErrorResponse();
  }
}
