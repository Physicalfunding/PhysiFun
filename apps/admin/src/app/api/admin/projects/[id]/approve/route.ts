import { type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  ApproveProjectPublicationUseCase,
  type ApproveProjectPublicationError,
} from "@physifun/application";
import { PrismaProjectCommandAdapter } from "@physifun/infrastructure";
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  notFoundResponse,
  unprocessableEntityResponse,
  internalErrorResponse,
} from "@/lib/api/response";

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    // ADMIN ロールチェック（第一防衛線）
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return unauthorizedResponse();
    const roles = (token.roles as string[] | undefined) ?? [];
    if (!roles.includes("ADMIN")) return unauthorizedResponse("ADMIN 権限が必要です");

    const reviewerId = typeof token.sub === "string" ? token.sub : undefined;
    if (!reviewerId) return unauthorizedResponse();

    const { id } = await params;

    // UUID v4 形式バリデーション
    if (!UUID_V4_REGEX.test(id)) {
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

    const adapter = new PrismaProjectCommandAdapter();
    const useCase = new ApproveProjectPublicationUseCase(adapter);
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
    case "REVIEWER_NOT_ADMIN":
      return unauthorizedResponse("ADMIN 権限が必要です");
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
    default: {
      const _exhaustive: never = error;
      return internalErrorResponse();
    }
  }
}
