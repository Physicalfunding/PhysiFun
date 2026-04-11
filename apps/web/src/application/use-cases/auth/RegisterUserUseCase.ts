import { User, UserType } from "@/domain/account/entities/User";
import { UserRepository } from "@/domain/account/repositories/UserRepository";
import { Email } from "@/domain/account/value-objects/Email";
import { Password } from "@/domain/account/value-objects/Password";
import { UserId } from "@/domain/account/value-objects/UserId";
import { type Result, type AppError, err, conflictError } from "@/domain/shared/result";

/**
 * ユーザー登録ユースケースの入力データ
 */
export interface RegisterUserInput {
  email: string;
  password: string;
  name: string;
  userType: UserType;
}

/**
 * RegisterUserUseCase
 * 新規ユーザー登録を処理するユースケース
 *
 * 責務:
 * - メールアドレスの重複チェック
 * - パスワードのハッシュ化
 * - ユーザーエンティティの作成と永続化
 */
export class RegisterUserUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  /**
   * ユーザー登録を実行
   * @param input 登録情報
   * @returns 作成されたユーザー、またはエラー
   */
  async execute(input: RegisterUserInput): Promise<Result<User, AppError>> {
    // 1. メールアドレスのバリデーション
    const emailResult = Email.create(input.email);
    if (!emailResult.success) {
      return emailResult;
    }

    // 2. パスワードのバリデーション
    const passwordResult = Password.create(input.password);
    if (!passwordResult.success) {
      return passwordResult;
    }

    // 3. メールアドレス重複チェック
    const existingUser = await this.userRepository.findByEmail(emailResult.data);
    if (existingUser) {
      return err(conflictError("このメールアドレスは既に登録されています"));
    }

    // 4. パスワードのハッシュ化
    const hashedPassword = await passwordResult.data.hash();

    // 5. ユーザーエンティティの作成
    const userResult = User.create({
      id: UserId.generate(),
      email: emailResult.data,
      passwordHash: hashedPassword,
      name: input.name,
      userType: input.userType,
    });

    if (!userResult.success) {
      return userResult;
    }

    // 6. ユーザーの永続化
    const createdUser = await this.userRepository.create(userResult.data);

    return { success: true, data: createdUser };
  }
}
