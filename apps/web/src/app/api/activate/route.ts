import { ActivateAccountUseCase } from "@physifun/application";
import {
  successResponse,
  validationErrorResponse,
  notFoundResponse,
  conflictResponse,
  unprocessableEntityResponse,
  internalErrorResponse,
} from "@/lib/api/response";
import { getActivateAccountPort, getPasswordHasher } from "@/lib/di/account";

/**
 * アカウント有効化 API エンドポイント
 *
 * POST /api/activate
 * Body: { token: string, password: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, password } = body;

    const useCase = new ActivateAccountUseCase(getActivateAccountPort(), getPasswordHasher());
    const result = await useCase.execute({ token, password });

    if (!result.ok) {
      const error = result.error;
      switch (error.type) {
        case "INVALID_INPUT":
          return validationErrorResponse("入力内容を確認してください");
        case "TOKEN_NOT_FOUND":
          return notFoundResponse("アクティベーショントークン");
        case "TOKEN_EXPIRED":
          return unprocessableEntityResponse(
            "トークンの有効期限が切れています。再度応募してください。"
          );
        case "ACCOUNT_ALREADY_ACTIVE":
          return conflictResponse("このアカウントは既に有効化されています");
        case "INVALID_PASSWORD":
          return validationErrorResponse(error.reason);
      }
    }

    return successResponse({ accountId: result.value.accountId });
  } catch {
    return internalErrorResponse();
  }
}
