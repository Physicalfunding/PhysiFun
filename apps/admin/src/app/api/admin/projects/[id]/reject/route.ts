import { type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
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

/**
 * POST /api/admin/projects/:id/reject
 *
 * 公開申請（PENDING_REVIEW）を運営が差戻す。ADMIN ロール必須。
 * リクエストボディに reviewerNote（差戻理由）が必須。
 *
 * 認証の注意:
 * - middleware.ts は /api パスを除外しているため、この Route Handler が唯一の認可チェック
 * - UseCase 層にも ADMIN ロール二重防御が入っているため、ルート側とユースケース側で二段階に守られている
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // 第一防衛線: ADMIN ロールチェック
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return unauthorizedResponse();
    const roles = (token.roles as string[] | undefined) ?? [];
    if (!roles.includes("ADMIN")) return unauthorizedResponse("ADMIN 権限が必要です");

    // reviewerId（= token.sub）は UseCase の AccountId VO で後続バリデーションされる
    if (!token.sub) return unauthorizedResponse();

    const { id } = await params;

    // UUID v4 形式バリデーション
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
      return validationErrorResponse("reviewerNote は必須です", {
        reviewerNote: ["差戻理由を入力してください"],
      });
    }

    const port = getRejectProjectPublicationPort();
    const useCase = new RejectProjectPublicationUseCase(port);
    const result = await useCase.execute({
      projectId: id,
      reviewerId: token.sub,
      reviewerNote: body.reviewerNote,
    });

    if (!result.ok) {
      return mapRejectError(result.error);
    }

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
      return notFoundResponse("アカウント");
    case "REVIEWER_NOT_ADMIN":
      return unauthorizedResponse("ADMIN 権限が必要です");
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
