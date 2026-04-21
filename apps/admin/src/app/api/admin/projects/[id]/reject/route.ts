import { type NextRequest } from "next/server";
import {
  RejectProjectPublicationUseCase,
  type RejectProjectPublicationError,
} from "@physifun/application";
import { getRejectProjectPublicationPort } from "@/lib/di/project";
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
import { logAdminAction } from "@/lib/api/auditLog";
import { enforceAdminRateLimit } from "@/lib/rateLimit";

/**
 * POST /api/admin/projects/:id/reject
 *
 * 公開申請（PENDING_REVIEW）を運営が差戻す。ADMIN ロール必須。
 * リクエストボディに reviewerNote（差戻理由）が必須。
 *
 * 認証の注意:
 * - middleware.ts は /api パスを除外しているため、この Route Handler が唯一の認可チェック
 * - UseCase 層にも二重防御が入っている
 * - 認証後にレート制限 (adminAccountId 単位 60 req/min) を適用 (#157 H1)
 * - 成功後に AdminAuditLog へ post-hook 書き込み (#157 H2)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const reviewerId = await getAuthenticatedAdminId();
    if (!reviewerId) return unauthorizedResponse();

    const limited = enforceAdminRateLimit("adminAction", reviewerId);
    if (limited) return limited;

    const { id } = await params;

    if (!isUuidV4(id)) {
      return validationErrorResponse("無効なプロジェクト ID です", {
        id: ["UUID v4 形式で指定してください"],
      });
    }

    let body: { reviewerNote?: unknown };
    try {
      body = await request.json();
    } catch {
      return validationErrorResponse("リクエストボディが不正です", {});
    }
    if (typeof body.reviewerNote !== "string" || body.reviewerNote.trim().length === 0) {
      return validationErrorResponse("reviewerNote は必須です", {
        reviewerNote: ["差戻理由を入力してください"],
      });
    }

    const port = getRejectProjectPublicationPort();
    const useCase = new RejectProjectPublicationUseCase(port);
    const result = await useCase.execute({
      projectId: id,
      reviewerId,
      reviewerNote: body.reviewerNote,
    });

    if (!result.ok) {
      return mapRejectError(result.error);
    }

    // #157 H2: 運営オペの監査証跡
    await logAdminAction({
      adminAccountId: reviewerId,
      action: "project.reject",
      targetType: "Project",
      targetId: result.value.projectId,
      metadata: { reviewerNote: body.reviewerNote.trim() },
    });

    return successResponse({ projectId: result.value.projectId });
  } catch (e) {
    console.error("[api] admin/projects/[id]/reject POST error:", e);
    return internalErrorResponse();
  }
}

function mapRejectError(error: RejectProjectPublicationError) {
  switch (error.type) {
    case "INVALID_PROJECT_ID":
      return validationErrorResponse("無効なプロジェクト ID です", {
        id: ["UUID v4 形式で指定してください"],
      });
    case "INVALID_REVIEWER_ID":
      return validationErrorResponse("無効なレビュワー ID です", {
        reviewerId: ["UUID v4 形式で指定してください"],
      });
    case "REVIEWER_NOTE_REQUIRED":
      return validationErrorResponse("reviewerNote は必須です", {
        reviewerNote: ["差戻理由を入力してください"],
      });
    case "REVIEWER_NOTE_TOO_LONG":
      return validationErrorResponse(
        `reviewerNote は ${error.maxLength} 文字以内で入力してください`,
        {
          reviewerNote: [`${error.maxLength} 文字以内で入力してください`],
        }
      );
    case "PROJECT_NOT_FOUND":
      return notFoundResponse("プロジェクト");
    case "REVIEWER_NOT_FOUND":
      // #157 M3: reviewer が DISABLED に落ちた稀ケース。401 で再ログインを促す。
      return unauthorizedResponse();
    case "INVALID_PROJECT_STATUS":
      return unprocessableEntityResponse(
        `このプロジェクトは差戻可能な状態ではありません（現在のステータス: ${error.currentStatus}）`
      );
    default: {
      // ProjectStateError の他 case が追加された際、コンパイルエラーで検知するためのガード
      const _exhaustive: never = error;
      return internalErrorResponse();
    }
  }
}
