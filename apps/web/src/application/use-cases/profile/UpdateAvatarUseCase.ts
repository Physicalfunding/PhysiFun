import { Result, AppError, ok, err, notFoundError, validationError } from "@/domain/shared/result";
import { UserRepository } from "@/domain/account/repositories/UserRepository";
import { ImageUploadService } from "@/infrastructure/storage/ImageUploadService";
import { UserId } from "@/domain/account/value-objects/UserId";

/**
 * 許可されている画像MIMEタイプ
 */
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * 最大ファイルサイズ（5MB）
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * アバター更新の入力データ
 */
export interface UpdateAvatarInput {
  userId: string;
  file: {
    name: string;
    type: string;
    size: number;
    buffer: Buffer;
  };
}

/**
 * アバター更新の出力データ
 */
export interface UpdateAvatarOutput {
  avatarUrl: string;
}

/**
 * UpdateAvatarUseCase
 * ユーザーアバター画像を更新するユースケース
 *
 * 責務:
 * - ファイルのバリデーション（タイプ、サイズ）
 * - 画像のアップロード
 * - 古い画像の削除（存在する場合）
 * - ユーザー情報の更新
 */
export class UpdateAvatarUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly imageUploadService: ImageUploadService
  ) {}

  /**
   * アバター更新を実行
   * @param input アバター更新に必要な情報
   * @returns 更新されたアバターURLまたはエラー
   */
  async execute(input: UpdateAvatarInput): Promise<Result<UpdateAvatarOutput, AppError>> {
    // 1. ユーザーIDのバリデーション
    const userIdResult = UserId.create(input.userId);
    if (!userIdResult.success) {
      return err(validationError("ユーザーIDの形式が無効です"));
    }

    // 2. ファイルタイプのバリデーション
    if (!ALLOWED_IMAGE_TYPES.includes(input.file.type)) {
      return err(validationError("画像ファイル（JPEG、PNG、WebP）のみアップロードできます"));
    }

    // 3. ファイルサイズのバリデーション
    if (input.file.size > MAX_FILE_SIZE) {
      return err(validationError("ファイルサイズは5MB以下にしてください"));
    }

    // 4. ユーザーの存在確認
    const user = await this.userRepository.findById(userIdResult.data);
    if (!user) {
      return err(notFoundError("ユーザー"));
    }

    // 5. 古いアバターの削除（存在する場合）
    if (user.avatarUrl) {
      try {
        // URLからパスを抽出して削除
        const oldPath = this.extractPathFromUrl(user.avatarUrl);
        if (oldPath) {
          await this.imageUploadService.deleteImage(oldPath);
        }
      } catch (deleteError) {
        // 削除失敗は警告のみで処理を続行
        console.warn("Failed to delete old avatar:", deleteError);
      }
    }

    // 6. 新しいアバターのアップロード
    const uploadResult = await this.imageUploadService.uploadImage(
      {
        buffer: input.file.buffer,
        name: input.file.name,
        type: input.file.type,
      },
      "avatars"
    );

    // 7. ユーザー情報の更新
    const updatedUser = user.updateAvatar(uploadResult.publicUrl);
    await this.userRepository.update(updatedUser);

    // 8. 結果を返却
    return ok({
      avatarUrl: uploadResult.publicUrl,
    });
  }

  /**
   * URLからストレージパスを抽出
   * @param url 画像のURL
   * @returns ストレージパス（抽出できない場合はnull）
   */
  private extractPathFromUrl(url: string): string | null {
    try {
      // Supabase StorageのURL形式: https://xxx.supabase.co/storage/v1/object/public/bucket-name/path
      // または一般的なURL: https://storage.example.com/avatars/filename.jpg
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/").filter(Boolean);

      // "public"の後のパスを取得（Supabase形式）
      const publicIndex = pathParts.indexOf("public");
      if (publicIndex >= 0 && publicIndex + 2 < pathParts.length) {
        // bucket-name以降のパスを結合
        return pathParts.slice(publicIndex + 2).join("/");
      }

      // avatarsフォルダが含まれている場合（テスト用やその他の形式）
      const avatarsIndex = pathParts.indexOf("avatars");
      if (avatarsIndex >= 0) {
        return pathParts.slice(avatarsIndex).join("/");
      }

      return null;
    } catch {
      return null;
    }
  }
}
