import { type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isUuidV4 } from "@physifun/domain";
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  notFoundResponse,
  unprocessableEntityResponse,
  internalErrorResponse,
} from "@/lib/api/response";
import {
  isValidSource,
  findOutboxMessage,
  completeOutboxMessage,
  type OutboxSource,
} from "@/lib/outbox";

/**
 * POST /api/admin/outbox/:id/complete
 *
 * Outbox メッセージを手動で完了マークする。ADMIN ロール必須。
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

    const message = await findOutboxMessage(source, id);
    if (!message) {
      return notFoundResponse("Outbox メッセージ");
    }

    if (message.sentAt !== null) {
      return unprocessableEntityResponse("既に送信済みです");
    }

    await completeOutboxMessage(source, id);

    return successResponse({ id, message: "完了としてマークしました" });
  } catch (e) {
    console.error("[api] admin/outbox/[id]/complete POST error:", e);
    return internalErrorResponse();
  }
}
