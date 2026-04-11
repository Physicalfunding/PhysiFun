import { Result, AppError, ok, err, notFoundError, validationError } from "@/domain/shared/result";
import { UserRepository } from "@/domain/account/repositories/UserRepository";
import { User, UserType } from "@/domain/account/entities/User";
import { UserId } from "@/domain/account/value-objects/UserId";

/**
 * プロフィール更新の入力データ
 */
export interface UpdateProfileInput {
  userId: string;
  name?: string;
  bio?: string | null;
  userType?: UserType;
}

/**
 * プロフィール更新の出力データ
 */
export interface UpdateProfileOutput {
  id: string;
  email: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  userType: UserType;
}

/**
 * UpdateProfileUseCase
 * ユーザープロフィールを更新するユースケース
 *
 * 責務:
 * - ユーザーの存在確認
 * - プロフィール情報の更新（名前、自己紹介、ユーザータイプ）
 * - 更新結果の返却
 */
export class UpdateProfileUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  /**
   * プロフィール更新を実行
   * @param input 更新するプロフィール情報
   * @returns 更新されたプロフィール情報またはエラー
   */
  async execute(input: UpdateProfileInput): Promise<Result<UpdateProfileOutput, AppError>> {
    // 1. ユーザーIDのバリデーション
    const userIdResult = UserId.create(input.userId);
    if (!userIdResult.success) {
      return err(validationError("ユーザーIDの形式が無効です"));
    }

    // 2. ユーザーの存在確認
    const user = await this.userRepository.findById(userIdResult.data);
    if (!user) {
      return err(notFoundError("ユーザー"));
    }

    // 3. プロフィール更新（Userエンティティのメソッドを使用）
    const updateResult = user.updateProfile({
      name: input.name,
      bio: input.bio,
      userType: input.userType,
    });

    if (!updateResult.success) {
      return updateResult;
    }

    // 4. 更新をリポジトリに保存
    const updatedUser = await this.userRepository.update(updateResult.data);

    // 5. 出力データに変換して返却
    return ok({
      id: updatedUser.id.value,
      email: updatedUser.email.value,
      name: updatedUser.name,
      bio: updatedUser.bio,
      avatarUrl: updatedUser.avatarUrl,
      userType: updatedUser.userType,
    });
  }
}
