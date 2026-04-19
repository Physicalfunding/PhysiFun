import { type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  ForceUnpublishProjectUseCase,
  type ForceUnpublishProjectError,
} from "@physifun/application";
import { getForceUnpublishProjectPort } from "@/lib/di/project";
import { isUuidV4 } from "@physifun/domain";
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  notFoundResponse,
  unprocessableEntityResponse,
  internalErrorResponse,
} from "@/lib/api/response";

/**
 * POST /api/admin/projects/:id/force-unpublish
 *
 * 運営による強制非公開 (PUBLISHED → DRAFT)。ADMIN ロール必須。
 * リクエストボディに reviewerNote（強制非公開理由）が必須。
 *
 * 認証の注意:
 * - middleware.ts は /api パスを除外しているため、この Route Handler が第一防衛線
 * - UseCase 層でも findAccountById → roles.includes("ADMIN") で二重防御している
 * - token.roles は auth.ts の jwt コールバックで設定される
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // 第一防衛線: ADMIN ロールチェック（token ベース）
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return unauthorizedResponse();
    const roles = (token.roles as string[] | undefined) ?? [];
    if (!roles.includes("ADMIN")) return unauthorizedResponse("ADMIN 権限が必要です");

    // token.sub は reviewer の AccountId
    const reviewerId = token.sub;
    if (!reviewerId) return unauthorizedResponse();

    const { id } = await params;

    // UUID 形式バリデーション
    if (!isUuidV4(id)) {
      return validationErrorResponse("無効なプロジェクト ID です", {
        id: ["UUID v4 形式で指定してください"],
      });
    }

    // リクエストボディ
    let body: { reviewerNote?: unknown };
    try {
      body = await request.json();
    } catch {
      return validationErrorResponse("リクエストボディが不正です", {});
    }
    if (typeof body.reviewerNote !== "string" || body.reviewerNote.trim().length === 0) {
      return validationErrorResponse("強制非公開理由は必須です", {
        reviewerNote: ["強制非公開理由を入力してください"],
      });
    }

    const port = getForceUnpublishProjectPort();
    const useCase = new ForceUnpublishProjectUseCase(port);
    const result = await useCase.execute({
      projectId: id,
      reviewerId,
      reviewerNote: body.reviewerNote,
    });

    if (!result.ok) {
      return mapForceUnpublishError(result.error);
    }

    return successResponse({
      projectId: result.value.projectId,
    });
  } catch (e) {
    console.error("[api] admin/projects/[id]/force-unpublish POST error:", e);
    return internalErrorResponse();
  }
}

function mapForceUnpublishError(error: ForceUnpublishProjectError) {
  switch (error.type) {
    case "INVALID_PROJECT_ID":
      return validationErrorResponse("無効なプロジェクト ID です", {
        id: ["UUID v4 形式で指定してください"],
      });
    case "INVALID_REVIEWER_ID":
      return validationErrorResponse("無効な審査者 ID です", {
        reviewerId: ["UUID v4 形式で指定してください"],
      });
    case "REVIEWER_NOTE_REQUIRED":
      return validationErrorResponse("強制非公開理由は必須です", {
        reviewerNote: ["強制非公開理由を入力してください"],
      });
    case "REVIEWER_NOTE_TOO_LONG":
      return validationErrorResponse("強制非公開理由が長すぎます", {
        reviewerNote: [`${error.maxLength} 文字以内で入力してください`],
      });
    case "PROJECT_NOT_FOUND":
      return notFoundResponse("プロジェクト");
    case "REVIEWER_NOT_FOUND":
      return notFoundResponse("アカウント");
    case "REVIEWER_NOT_ADMIN":
      return unauthorizedResponse("ADMIN 権限が必要です");
    case "DOMAIN_ERROR":
      return unprocessableEntityResponse("このプロジェクトは現在の状態では強制非公開にできません");
    case "FEEDBACK_ERROR":
      return unprocessableEntityResponse("審査フィードバックの作成に失敗しました");
    default: {
      const _exhaustive: never = error;
      return internalErrorResponse();
    }
  }
}
