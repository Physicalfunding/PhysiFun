import { type NextRequest } from "next/server";
import {
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
import { getOutboxQueryService } from "@/lib/di/queryServices";
import { getAuthenticatedAdminId } from "@/lib/api/auth";
import { enforceAdminRateLimit } from "@/lib/rateLimit";

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
    // 運営認証は `@/lib/api/auth#getAuthenticatedAdminId` で AdminSession 経由の Database 戦略 (#145)
    const reviewerId = await getAuthenticatedAdminId();
    if (!reviewerId) return unauthorizedResponse();

    // #166: 認証済みでの大量スクレイピング抑止のため、GET にもレート制限を適用
    const limited = enforceAdminRateLimit("adminRead", reviewerId);
    if (limited) return limited;

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

    const queryService = getOutboxQueryService();
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
