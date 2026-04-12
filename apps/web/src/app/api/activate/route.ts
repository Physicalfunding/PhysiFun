import {
  ActivateAccountUseCase,
  type ActivateAccountPort,
  type AccountForActivation,
  type PasswordHasher,
} from "@physifun/application";
import {
  successResponse,
  validationErrorResponse,
  notFoundResponse,
  conflictResponse,
  unprocessableEntityResponse,
  internalErrorResponse,
} from "@/lib/api/response";

// TODO: infrastructure 層に移動する（Prisma 実装）
const stubActivateAccountPort: ActivateAccountPort = {
  async findByActivationToken(_token: string): Promise<AccountForActivation | null> {
    // TODO: Prisma でアカウントを検索する実装に置き換える
    return null;
  },
  async activate(_params: { accountId: string; passwordHash: string }): Promise<void> {
    // TODO: Prisma でアカウントを有効化する実装に置き換える
  },
};

// TODO: @security-stub infrastructure 層に移動する（bcrypt 等の実装）
const stubPasswordHasher: PasswordHasher = {
  async hash(password: string): Promise<string> {
    // TODO: @security-stub bcrypt 等の本番用ハッシュ実装に差し替えること
    return `hashed_${password}`;
  },
};

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

    const useCase = new ActivateAccountUseCase(stubActivateAccountPort, stubPasswordHasher);
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
