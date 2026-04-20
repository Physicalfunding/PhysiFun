import { createClient } from "@supabase/supabase-js";
import { isAllowedImageUrl } from "@physifun/ui-shared";

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
 * 返却する `publicUrl` は `NEXT_PUBLIC_SUPABASE_URL` 配下の
 * `*.supabase.co`（または環境変数で指定された独自ドメイン）となり、
 * `@physifun/ui-shared` の `isAllowedImageUrl` allowlist に合致する想定
 * (Issue #120)。
 *
 * @see https://supabase.com/docs/guides/storage
 */
export class SupabaseImageUploadService implements ImageUploadService {
  private supabase;
  private bucketName: string;
  private bucketInitialized = false;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase environment variables are not set");
    }

    // バケット名を環境変数から取得（デフォルト: project-images）
    this.bucketName = process.env.SUPABASE_STORAGE_BUCKET || "project-images";

    // サービスロールキーを使用してSupabaseクライアントを作成
    // これによりストレージへの書き込み権限を持つ
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * バケットの存在を確認し、存在しない場合は作成を試みる
   */
  private async ensureBucketExists(): Promise<void> {
    if (this.bucketInitialized) {
      return;
    }

    // バケットの存在確認
    const { data: buckets, error: listError } = await this.supabase.storage.listBuckets();

    if (listError) {
      console.error(`Failed to list buckets: ${listError.message}`);
      // リスト取得に失敗しても、バケットは存在する可能性があるため続行
      this.bucketInitialized = true;
      return;
    }

    const bucketExists = buckets?.some((bucket) => bucket.name === this.bucketName);

    if (!bucketExists) {
      // バケットが存在しない場合は作成を試みる
      const { error: createError } = await this.supabase.storage.createBucket(this.bucketName, {
        public: true, // 画像は公開アクセス可能にする
        fileSizeLimit: 52428800, // 50MiB
        allowedMimeTypes: ["image/png", "image/jpeg", "image/gif", "image/webp"],
      });

      if (createError) {
        console.error(`Failed to create bucket '${this.bucketName}': ${createError.message}`);
        throw new Error(
          `Storage bucket '${this.bucketName}' does not exist and could not be created: ${createError.message}`
        );
      }

      console.log(`Created storage bucket: ${this.bucketName}`);
    }

    this.bucketInitialized = true;
  }

  /**
   * 画像をSupabase Storageにアップロード
   */
  async uploadImage(
    file: { buffer: Buffer; name: string; type: string },
    folder: string
  ): Promise<UploadResult> {
    // バケットの存在を確認（初回のみ）
    await this.ensureBucketExists();

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
 * テスト環境やSupabase未設定時に使用。
 *
 * Issue #120 / PR #155 レビュー対応:
 * - `publicUrl` は `isAllowedImageUrl` の allowlist（Unsplash `images.unsplash.com/photo-*`）
 *   に合致する URL を返す。これにより Mock 経路でも後段の allowlist チェックを
 *   通過可能にする（旧: `mock-storage.example.com` は allowlist 外で画像が表示されない）。
 * - `uploadImage` で fail-safe として `isAllowedImageUrl(publicUrl)` ガードを追加。
 *   万一 Mock の URL が allowlist から外れた場合は例外 throw で早期検出する。
 * - production では Mock の利用自体を throw で禁止し、Supabase 未設定のまま
 *   本番デプロイされる事故を防ぐ。
 */
const MOCK_PUBLIC_URL_BASE = "https://images.unsplash.com/photo-mock";

export class MockImageUploadService implements ImageUploadService {
  constructor() {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "MockImageUploadService must not be used in production. " +
          "Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set."
      );
    }
  }

  async uploadImage(
    file: { buffer: Buffer; name: string; type: string },
    folder: string
  ): Promise<UploadResult> {
    const timestamp = Date.now();
    const extension = file.name.split(".").pop() || "jpg";
    const path = `${folder}/${timestamp}.${extension}`;

    const publicUrl = this.buildMockPublicUrl(path);

    // fail-safe: 生成した URL が allowlist に合致しない場合は早期に失敗させる。
    if (!isAllowedImageUrl(publicUrl)) {
      throw new Error(
        `MockImageUploadService produced a URL that is not in the image allowlist: ${publicUrl}`
      );
    }

    return {
      path,
      publicUrl,
    };
  }

  async deleteImage(_path: string): Promise<void> {
    // モックでは何もしない
  }

  getPublicUrl(path: string): string {
    return this.buildMockPublicUrl(path);
  }

  /**
   * `https://images.unsplash.com/photo-mock/<path>` 形式の URL を生成する。
   * Unsplash 画像 CDN のホストに擬似パスを載せる形で allowlist（Unsplash
   * ホスト + `/photo-` プレフィックス）に合致させる。実際に fetch しても
   * 404 になるが、UI 表示は Unsplash CDN に委ねるため問題ない想定。
   */
  private buildMockPublicUrl(path: string): string {
    // パスに含まれるスラッシュなどはそのまま連結（ファイル名は拡張子のみ）。
    return `${MOCK_PUBLIC_URL_BASE}/${path}`;
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
