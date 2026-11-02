import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ImageStoragePort } from "@physifun/application";

/** バケット名の既定値（設計書 §5.7。環境変数 `SUPABASE_STORAGE_BUCKET` で変えられる） */
const DEFAULT_BUCKET_NAME = "project-images";

/**
 * Supabase Storage に画像を置く実装
 *
 * サービスロールキーで接続し、あらかじめ作ってある公開バケットに書き込む（バケットは作らない。
 * 無ければアップロードがエラーになって気づける）。返す公開 URL は `NEXT_PUBLIC_SUPABASE_URL` のホスト配下になり、
 * `@physifun/ui-shared` の `isAllowedImageUrl` を通る想定（#120）。
 *
 * @see https://supabase.com/docs/guides/storage
 */
export class SupabaseImageStorage implements ImageStoragePort {
  private readonly supabase: SupabaseClient;
  private readonly bucketName: string;

  constructor(params: { supabaseUrl: string; serviceRoleKey: string; bucketName?: string }) {
    this.bucketName = params.bucketName ?? DEFAULT_BUCKET_NAME;
    // サーバー側で使うので、セッションの保持やトークンの自動更新は切る
    this.supabase = createClient(params.supabaseUrl, params.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async upload(params: {
    path: string;
    bytes: Uint8Array;
    contentType: string;
  }): Promise<{ publicUrl: string }> {
    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(params.path, params.bytes, { contentType: params.contentType, upsert: false });
    if (error) {
      throw new Error(`Failed to upload image to '${this.bucketName}': ${error.message}`);
    }
    return { publicUrl: this.getPublicUrl(params.path) };
  }

  getPublicUrl(path: string): string {
    return this.supabase.storage.from(this.bucketName).getPublicUrl(path).data.publicUrl;
  }
}

/**
 * Supabase が設定されていない環境（ローカル・テスト・CI）用の実装。どこにも保存しない。
 *
 * 公開 URL は `isAllowedImageUrl` が許す Unsplash のホスト（`images.unsplash.com/photo-*`）に擬似パスを載せた形にする
 * （#120 / PR #155）。実際に開いても 404 だが、後段の URL の検査を通せる。
 * 本番で使われないよう、`NODE_ENV=production` では構築時に例外を投げる。
 */
const MOCK_PUBLIC_URL_BASE = "https://images.unsplash.com/photo-mock";

export class MockImageStorage implements ImageStoragePort {
  constructor() {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "MockImageStorage must not be used in production. " +
          "Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set."
      );
    }
  }

  async upload(params: {
    path: string;
    bytes: Uint8Array;
    contentType: string;
  }): Promise<{ publicUrl: string }> {
    return { publicUrl: this.getPublicUrl(params.path) };
  }

  getPublicUrl(path: string): string {
    return `${MOCK_PUBLIC_URL_BASE}/${path}`;
  }
}

/**
 * 環境変数に応じた画像の置き場所を返す。
 * `NEXT_PUBLIC_SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` があれば Supabase、無ければモック。
 */
export function createImageStorage(): ImageStoragePort {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceRoleKey) {
    return new SupabaseImageStorage({
      supabaseUrl,
      serviceRoleKey,
      bucketName: process.env.SUPABASE_STORAGE_BUCKET || undefined,
    });
  }
  console.warn("Supabase not configured, using mock image storage");
  return new MockImageStorage();
}
