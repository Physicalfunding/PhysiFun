import { type NextRequest } from "next/server";
import {
  ApproveProjectPublicationUseCase,
  type ApproveProjectPublicationError,
} from "@physifun/application";
import { getApproveProjectPublicationPort } from "@/lib/di/project";
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
 * POST /api/admin/projects/:id/approve
 *
 * プロジェクトの公開申請を承認する。ADMIN ロール必須。
 * body: { note?: string }
 *
 * 認証の注意:
 * - middleware.ts は /api パスを除外しているため、この Route Handler が第一防衛線
 * - UseCase 層でも findAccountById + ADMIN ロールチェックを二重に実施する
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // 運営認証は `@/lib/api/auth#getAuthenticatedAdminId` で AdminSession 経由の Database 戦略 (#145)
    const reviewerId = await getAuthenticatedAdminId();
    if (!reviewerId) return unauthorizedResponse();

    const { id } = await params;

    // UUID v4 形式バリデーション
    if (!isUuidV4(id)) {
      return validationErrorResponse("無効なプロジェクト ID です", {
        id: ["UUID v4 形式で指定してください"],
      });
    }

    // リクエストボディ（note は optional）
    let note: string | undefined;
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      let body: { note?: unknown };
      try {
        body = (await request.json()) as { note?: unknown };
      } catch {
        return validationErrorResponse("リクエストボディが不正です", {});
      }
      if (body.note !== undefined && body.note !== null) {
        if (typeof body.note !== "string") {
          return validationErrorResponse("note は文字列で指定してください", {
            note: ["文字列である必要があります"],
          });
        }
        note = body.note;
      }
    }

    const port = getApproveProjectPublicationPort();
    const useCase = new ApproveProjectPublicationUseCase(port);
    const result = await useCase.execute({
      projectId: id,
      reviewerId,
      note,
    });

    if (!result.ok) {
      return mapApproveError(result.error);
    }

    return successResponse({ projectId: result.value.projectId });
  } catch (e) {
    console.error("[api] admin/projects/[id]/approve POST error:", e);
    return internalErrorResponse();
  }
}

function mapApproveError(error: ApproveProjectPublicationError) {
  switch (error.type) {
    case "INVALID_PROJECT_ID":
      return validationErrorResponse("無効なプロジェクト ID です", {
        id: ["UUID v4 形式で指定してください"],
      });
    case "INVALID_REVIEWER_ID":
      return validationErrorResponse("無効な審査者 ID です", {
        reviewerId: ["UUID v4 形式で指定してください"],
      });
    case "PROJECT_NOT_FOUND":
      return notFoundResponse("プロジェクト");
    case "REVIEWER_NOT_FOUND":
      return notFoundResponse("アカウント");
    case "INVALID_PROJECT_STATUS":
      return unprocessableEntityResponse(
        "このプロジェクトは承認可能な状態ではありません（PENDING_REVIEW のみ承認可能）"
      );
    case "OWNER_PUBLISHED_LIMIT_EXCEEDED":
      return unprocessableEntityResponse(
        `公開中プロジェクトの上限（${error.maxCount} 件）に達しています`
      );
    case "REVIEW_FEEDBACK_ERROR":
      return unprocessableEntityResponse("審査フィードバックの登録に失敗しました");
    case "REVIEWER_NOTE_TOO_LONG":
      return validationErrorResponse(`コメントは ${error.maxLength} 文字以内で入力してください`, {
        note: [`${error.maxLength} 文字以内`],
      });
    default: {
      const _exhaustive: never = error;
      return internalErrorResponse();
    }
  }
}
