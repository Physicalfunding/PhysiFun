/**
 * 画像の置き場所（Supabase Storage）のポート
 *
 * ストーリーの画像（#319）のほか、プロフィールやプロジェクトのアイコン（#213）も同じ仕組みで置く。
 * インフラ層で実装する。
 */
export interface ImageStoragePort {
  /**
   * 画像を保存し、公開 URL を返す。
   * 同じ path にすでにファイルがあるときは上書きせず、例外を投げる。
   */
  upload(params: {
    readonly path: string;
    readonly bytes: Uint8Array;
    readonly contentType: string;
  }): Promise<{ readonly publicUrl: string }>;

  /**
   * path の公開 URL を組み立てる（保存はしない）。
   * 本文に入っている画像の URL が、自分の Storage の決まった場所のものかを確かめるのに使う。
   */
  getPublicUrl(path: string): string;
}
