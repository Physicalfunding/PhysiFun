import { createClient } from "@supabase/supabase-js";

/**
 * アップロード結果の型定義
 */
export interface UploadResult {
  path: string;
  publicUrl: string;
}

/**
 * ImageUploadService インターフェース
 * 画像アップロード機能を抽象化
 */
export interface ImageUploadService {
  /**
   * 画像をアップロード
   * @param file ファイルオブジェクト
   * @param folder 保存先フォルダ名
   * @returns アップロード結果（パスと公開URL）
   */
  uploadImage(
    file: { buffer: Buffer; name: string; type: string },
    folder: string
  ): Promise<UploadResult>;

  /**
   * 画像を削除
   * @param path 削除する画像のパス
   */
  deleteImage(path: string): Promise<void>;

  /**
   * 公開URLを取得
   * @param path 画像のパス
   * @returns 公開URL
   */
  getPublicUrl(path: string): string;
}

/**
 * SupabaseImageUploadService
 * Supabase Storageを使用した画像アップロードサービス
 *
 * @see https://supabase.com/docs/guides/storage
 */
export class SupabaseImageUploadService implements ImageUploadService {
  private supabase;
  private bucketName = "campfire-images";

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase environment variables are not set");
    }

    // サービスロールキーを使用してSupabaseクライアントを作成
    // これによりストレージへの書き込み権限を持つ
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * 画像をSupabase Storageにアップロード
   */
  async uploadImage(
    file: { buffer: Buffer; name: string; type: string },
    folder: string
  ): Promise<UploadResult> {
    // ユニークなファイル名を生成（タイムスタンプ + 元のファイル名）
    const timestamp = Date.now();
    const extension = file.name.split(".").pop() || "jpg";
    const uniqueFileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${extension}`;
    const filePath = `${folder}/${uniqueFileName}`;

    // Supabase Storageにアップロード
    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(filePath, file.buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      throw new Error(`Failed to upload image: ${error.message}`);
    }

    // 公開URLを取得
    const publicUrl = this.getPublicUrl(filePath);

    return {
      path: filePath,
      publicUrl,
    };
  }

  /**
   * Supabase Storageから画像を削除
   */
  async deleteImage(path: string): Promise<void> {
    const { error } = await this.supabase.storage.from(this.bucketName).remove([path]);

    if (error) {
      console.error(`Failed to delete image: ${error.message}`);
      // 削除失敗は警告として扱い、例外は投げない
    }
  }

  /**
   * 公開URLを生成
   */
  getPublicUrl(path: string): string {
    const { data } = this.supabase.storage.from(this.bucketName).getPublicUrl(path);

    return data.publicUrl;
  }
}

/**
 * モック用のImageUploadService実装
 * テスト環境やSupabase未設定時に使用
 */
export class MockImageUploadService implements ImageUploadService {
  async uploadImage(
    file: { buffer: Buffer; name: string; type: string },
    folder: string
  ): Promise<UploadResult> {
    const timestamp = Date.now();
    const extension = file.name.split(".").pop() || "jpg";
    const path = `${folder}/${timestamp}.${extension}`;

    return {
      path,
      publicUrl: `https://mock-storage.example.com/${path}`,
    };
  }

  async deleteImage(_path: string): Promise<void> {
    // モックでは何もしない
  }

  getPublicUrl(path: string): string {
    return `https://mock-storage.example.com/${path}`;
  }
}

/**
 * 環境に応じたImageUploadServiceを取得
 * Supabase環境変数が設定されていればSupabase実装、なければモック実装を返す
 */
export function getImageUploadService(): ImageUploadService {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseServiceKey) {
    return new SupabaseImageUploadService();
  }

  console.warn("Supabase not configured, using mock image upload service");
  return new MockImageUploadService();
}
