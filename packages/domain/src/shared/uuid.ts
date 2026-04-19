/**
 * UUID v4 バリデーションユーティリティ
 *
 * ドメイン層の各 ID 値オブジェクトおよびアプリケーション層の
 * 入力バリデーションで共通利用する。
 */

export const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * 文字列が UUID v4 形式かどうかを判定する
 */
export function isUuidV4(value: string): boolean {
  return UUID_V4_REGEX.test(value);
}
