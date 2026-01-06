import { Result, AppError, ok, err, notFoundError, validationError } from "@/domain/shared/result";
import { UserRepository } from "@/domain/account/repositories/UserRepository";
import { UserType } from "@/domain/account/entities/User";
import { UserId } from "@/domain/account/value-objects/UserId";

/**
 * プロフィール取得の入力データ
 */
export interface GetProfileInput {
  userId: string;
}

/**
 * プロフィール取得の出力データ
 */
export interface GetProfileOutput {
  id: string;
  email: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  userType: UserType;
}

/**
 * GetProfileUseCase
 * ユーザープロフィールを取得するユースケース
 *
 * 責務:
 * - ユーザーIDのバリデーション
 * - ユーザー情報の取得
 * - プロフィール情報の返却
 */
export class GetProfileUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  /**
   * プロフィール取得を実行
   * @param input ユーザーID
   * @returns プロフィール情報またはエラー
   */
  async execute(input: GetProfileInput): Promise<Result<GetProfileOutput, AppError>> {
    // 1. ユーザーIDのバリデーション
    const userIdResult = UserId.create(input.userId);
    if (!userIdResult.success) {
      return err(validationError("ユーザーIDの形式が無効です"));
    }

    // 2. ユーザー情報の取得
    const user = await this.userRepository.findById(userIdResult.data);
    if (!user) {
      return err(notFoundError("ユーザー"));
    }

    // 3. 出力データに変換して返却
    return ok({
      id: user.id.value,
      email: user.email.value,
      name: user.name,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      userType: user.userType,
    });
  }
}
