import { type NextRequest } from "next/server";
import { isUuidV4 } from "@physifun/domain";
import {
  PrismaOutboxCommandAdapter,
  isValidOutboxSource,
  type OutboxSource,
} from "@physifun/infrastructure";
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  unprocessableEntityResponse,
  internalErrorResponse,
} from "@/lib/api/response";
import { getAuthenticatedAdminId } from "@/lib/api/auth";

const commandAdapter = new PrismaOutboxCommandAdapter();

/**
 * POST /api/admin/outbox/:id/retry
 *
 * Outbox メッセージを手動リトライ対象に戻す。ADMIN ロール必須。
 *
 * リクエストボディ:
 * - source: "leaderApplication" | "project" (必須)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // 運営認証は `@/lib/api/auth#getAuthenticatedAdminId` で AdminSession 経由の Database 戦略 (#145)
    const reviewerId = await getAuthenticatedAdminId();
    if (!reviewerId) return unauthorizedResponse();

    const { id } = await params;

    if (!isUuidV4(id)) {
      return validationErrorResponse("無効な ID です", {
        id: ["UUID v4 形式で指定してください"],
      });
    }

    // リクエストボディからソースを取得
    let body: { source?: unknown };
    try {
      body = (await request.json()) as { source?: unknown };
    } catch {
      return validationErrorResponse("リクエストボディが不正です", {});
    }

    if (typeof body.source !== "string" || !isValidOutboxSource(body.source)) {
      return validationErrorResponse("source パラメータが必要です", {
        source: ["leaderApplication, project のいずれかを指定してください"],
      });
    }
    const source: OutboxSource = body.source;

    // updateMany with sentAt: null で TOCTOU を防止
    const result = await commandAdapter.retry(source, id);

    if (result.count === 0) {
      return unprocessableEntityResponse("対象メッセージが見つからないか、既に送信済みです");
    }

    return successResponse({ id, message: "リトライ対象に戻しました" });
  } catch (e) {
    console.error("[api] admin/outbox/[id]/retry POST error:", e);
    return internalErrorResponse();
  }
}
