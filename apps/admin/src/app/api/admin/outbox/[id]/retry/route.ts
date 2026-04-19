import { type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isUuidV4 } from "@physifun/domain";
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  unprocessableEntityResponse,
  internalErrorResponse,
} from "@/lib/api/response";
import { isValidSource, retryOutboxMessage, type OutboxSource } from "@/lib/outbox";

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
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return unauthorizedResponse();
    const roles = (token.roles as string[] | undefined) ?? [];
    if (!roles.includes("ADMIN")) return unauthorizedResponse("ADMIN 権限が必要です");

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

    if (typeof body.source !== "string" || !isValidSource(body.source)) {
      return validationErrorResponse("source パラメータが必要です", {
        source: ["leaderApplication, project のいずれかを指定してください"],
      });
    }
    const source: OutboxSource = body.source;

    // updateMany with sentAt: null で TOCTOU を防止
    const result = await retryOutboxMessage(source, id);

    if (result.count === 0) {
      return unprocessableEntityResponse("対象メッセージが見つからないか、既に送信済みです");
    }

    return successResponse({ id, message: "リトライ対象に戻しました" });
  } catch (e) {
    console.error("[api] admin/outbox/[id]/retry POST error:", e);
    return internalErrorResponse();
  }
}
