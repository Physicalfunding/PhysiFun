import { type NextRequest } from "next/server";
import {
  RejectLeaderApplicationUseCase,
  type RejectLeaderApplicationError,
} from "@physifun/application";
import { PrismaRejectLeaderApplicationAdapter } from "@physifun/infrastructure";
import { isUuidV4 } from "@physifun/domain";
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  notFoundResponse,
  unprocessableEntityResponse,
  internalErrorResponse,
} from "@/lib/api/response";
import { getAuthenticatedAdminId } from "@/lib/api/auth";

/**
 * POST /api/admin/applications/:id/reject
 *
 * リーダー応募を却下する。ADMIN ロール必須。
 * リクエストボディに reviewerNote（却下理由）が必須。
 *
 * 認証の注意:
 * - middleware.ts は /api パスを除外しているため、この Route Handler が唯一の認可チェック
 * - 運営認証は `@/lib/api/auth#getAuthenticatedAdminId` で AdminSession 経由の Database 戦略 (#145)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // リクエストボディ
    let body: { reviewerNote?: string };
    try {
      body = await request.json();
    } catch {
      return validationErrorResponse("リクエストボディが不正です", {});
    }
    if (!body.reviewerNote || body.reviewerNote.trim().length === 0) {
      return validationErrorResponse("却下理由は必須です", {
        reviewerNote: ["却下理由を入力してください"],
      });
    }

    const adapter = new PrismaRejectLeaderApplicationAdapter();
    const useCase = new RejectLeaderApplicationUseCase(adapter);
    const result = await useCase.execute({
      applicationId: id,
      reviewerNote: body.reviewerNote,
    });

    if (!result.ok) {
      return mapRejectError(result.error);
    }

    return successResponse({
      applicationId: result.value.applicationId,
    });
  } catch (e) {
    console.error("[api] admin/applications/[id]/reject POST error:", e);
    return internalErrorResponse();
  }
}

function mapRejectError(error: RejectLeaderApplicationError) {
  switch (error.type) {
    case "APPLICATION_NOT_FOUND":
      return notFoundResponse("応募");
    case "NOT_PENDING":
      return unprocessableEntityResponse("この応募は審査待ち状態ではありません");
    case "VALIDATION_ERROR":
      return validationErrorResponse(
        "入力内容を確認してください",
        Object.fromEntries(error.issues.map((i) => [i.path, [i.message]]))
      );
    default: {
      const _exhaustive: never = error;
      return internalErrorResponse();
    }
  }
}
