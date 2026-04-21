import { type NextRequest } from "next/server";
import {
  ApproveLeaderApplicationUseCase,
  type ApproveLeaderApplicationError,
} from "@physifun/application";
import { PrismaApproveLeaderApplicationAdapter } from "@physifun/infrastructure";
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
 * POST /api/admin/applications/:id/approve
 *
 * リーダー応募を承認する。ADMIN ロール必須。
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

    const adapter = new PrismaApproveLeaderApplicationAdapter();
    const useCase = new ApproveLeaderApplicationUseCase(adapter);
    const result = await useCase.execute({ applicationId: id, reviewerId });

    if (!result.ok) {
      return mapApproveError(result.error);
    }

    return successResponse({
      applicationId: result.value.applicationId,
      accountId: result.value.accountId,
    });
  } catch (e) {
    console.error("[api] admin/applications/[id]/approve POST error:", e);
    return internalErrorResponse();
  }
}

function mapApproveError(error: ApproveLeaderApplicationError) {
  switch (error.type) {
    case "APPLICATION_NOT_FOUND":
      return notFoundResponse("応募");
    case "ACCOUNT_NOT_FOUND":
      return notFoundResponse("アカウント");
    case "NOT_PENDING":
      return unprocessableEntityResponse("この応募は審査待ち状態ではありません");
    case "ALREADY_LEADER":
      return unprocessableEntityResponse("このアカウントは既にリーダーです");
    case "INVALID_REVIEWER_ID":
      return validationErrorResponse("無効な審査者 ID です", {
        reviewerId: ["UUID v4 形式で指定してください"],
      });
    case "REVIEWER_NOT_FOUND":
      return notFoundResponse("アカウント");
    default: {
      const _exhaustive: never = error;
      return internalErrorResponse();
    }
  }
}
