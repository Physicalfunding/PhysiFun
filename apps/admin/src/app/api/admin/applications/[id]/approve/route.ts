import { type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  ApproveLeaderApplicationUseCase,
  type ApproveLeaderApplicationError,
} from "@physifun/application";
import { PrismaApproveLeaderApplicationAdapter } from "@physifun/infrastructure";
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
 * POST /api/admin/applications/:id/approve
 *
 * リーダー応募を承認する。ADMIN ロール必須。
 *
 * 認証の注意:
 * - middleware.ts は /api パスを除外しているため、この Route Handler が唯一の認可チェック
 * - token.roles は auth.ts の jwt コールバックで設定される（TODO: #61 で実装予定）
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // ADMIN ロールチェック
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return unauthorizedResponse();
    const roles = (token.roles as string[] | undefined) ?? [];
    if (!roles.includes("ADMIN")) return unauthorizedResponse("ADMIN 権限が必要です");

    const { id } = await params;

    // UUID 形式バリデーション
    if (!UUID_V4_REGEX.test(id)) {
      return validationErrorResponse("無効な応募 ID です", {
        id: ["UUID v4 形式で指定してください"],
      });
    }

    const adapter = new PrismaApproveLeaderApplicationAdapter();
    const useCase = new ApproveLeaderApplicationUseCase(adapter);
    const result = await useCase.execute({ applicationId: id });

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
  }
}
