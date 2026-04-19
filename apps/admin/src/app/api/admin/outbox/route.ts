import { type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  PrismaOutboxQueryService,
  deriveOutboxStatus,
  isValidOutboxSource,
  isValidOutboxStatus,
  type OutboxSource,
  type OutboxStatus,
} from "@physifun/infrastructure";
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  internalErrorResponse,
} from "@/lib/api/response";

const queryService = new PrismaOutboxQueryService();

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
    if (!sourceParam || !isValidOutboxSource(sourceParam)) {
      return validationErrorResponse("source パラメータが必要です", {
        source: ["leaderApplication, project のいずれかを指定してください"],
      });
    }
    const source: OutboxSource = sourceParam;

    // status バリデーション
    let status: OutboxStatus | undefined;
    if (statusParam) {
      if (!isValidOutboxStatus(statusParam)) {
        return validationErrorResponse("無効なステータスです", {
          status: ["pending, retrying, dead-lettered, sent のいずれかを指定してください"],
        });
      }
      status = statusParam;
    }

    const page = Math.max(1, Number(pageParam) || 1);
    const perPage = Math.min(100, Math.max(1, Number(perPageParam) || 20));

    const result = await queryService.findMany(source, { status, page, perPage });

    return successResponse({
      items: result.items.map((item) => ({
        id: item.id,
        type: item.type,
        createdAt: item.createdAt.toISOString(),
        sentAt: item.sentAt?.toISOString() ?? null,
        attempts: item.attempts,
        lastError: item.lastError,
        nextRetryAt: item.nextRetryAt?.toISOString() ?? null,
        deadLetteredAt: item.deadLetteredAt?.toISOString() ?? null,
        status: deriveOutboxStatus(item),
        source,
      })),
      totalCount: result.totalCount,
      page,
      perPage,
    });
  } catch (e) {
    console.error("[api] admin/outbox GET error:", e);
    return internalErrorResponse();
  }
}
