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
import { logAdminAction } from "@/lib/api/auditLog";
import { enforceAdminRateLimit } from "@/lib/rateLimit";

const commandAdapter = new PrismaOutboxCommandAdapter();

/**
 * POST /api/admin/outbox/:id/retry
 *
 * Outbox メッセージを手動リトライ対象に戻す。ADMIN ロール必須。
 *
 * リクエストボディ:
 * - source: "leaderApplication" | "project" (必須)
 *
 * 認証の注意:
 * - middleware.ts は /api パスを除外しているため、この Route Handler が第一防衛線
 * - 認証後にレート制限 (adminAccountId 単位 60 req/min) を適用 (#157 H1)
 * - 成功後に AdminAuditLog へ post-hook 書き込み (#158 M3)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // 運営認証は `@/lib/api/auth#getAuthenticatedAdminId` で AdminSession 経由の Database 戦略 (#145)
    const reviewerId = await getAuthenticatedAdminId();
    if (!reviewerId) return unauthorizedResponse();

    const limited = enforceAdminRateLimit("adminAction", reviewerId);
    if (limited) return limited;

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

    // #158 M3 / #159 H-2: outbox 手動操作を監査証跡に残す。
    // logAdminAction は内部で try/catch して log-and-continue する設計 (auditLog.ts 参照)。
    // 監査 DB 書き込みの遅延をレスポンス p99 に載せないよう fire-and-forget で呼ぶ。
    void logAdminAction({
      adminAccountId: reviewerId,
      action: "outbox.retry",
      targetType: "OutboxMessage",
      targetId: id,
      metadata: { source },
    });

    return successResponse({ id, message: "リトライ対象に戻しました" });
  } catch (e) {
    console.error("[api] admin/outbox/[id]/retry POST error:", e);
    return internalErrorResponse();
  }
}
