import { randomBytes } from "node:crypto";

/**
 * UUID ユーティリティ（形式チェック・UUID v7 の生成）
 *
 * ドメイン層の各 ID 値オブジェクトおよびアプリケーション層の
 * 入力バリデーションで共通利用する。
 *
 * ID は UUID v4（既存）と UUID v7（#358 で移行中）が混ざるため、
 * 形式チェックは `isUuid()` で両方を通す。
 */

export const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** version の桁（3 つ目の区切りの先頭）が 4 か 7、variant が `10`（8・9・a・b）の UUID */
const UUID_V4_OR_V7_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[47][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * 文字列が UUID v4 形式かどうかを判定する
 *
 * @deprecated ID の形式チェックには `isUuid()` を使う（ID の生成を v7 に変えるとき（#369）に消す）
 */
export function isUuidV4(value: string): boolean {
  return UUID_V4_REGEX.test(value);
}

/**
 * 文字列が UUID v4 か v7 の形式かどうかを判定する
 */
export function isUuid(value: string): boolean {
  return UUID_V4_OR_V7_REGEX.test(value);
}

/**
 * UUID v7 を生成する（RFC 9562 §5.7）
 *
 * - 先頭 48 bit: Unix 時刻（ミリ秒）。時刻の違う値どうしは、文字列の大小が時刻の順になる
 * - version 4 bit: `0111`（7）
 * - variant 2 bit: `10`
 * - 残り 74 bit: 乱数
 *
 * 同じミリ秒の中で作った値どうしの順番は保証しない（RFC 9562 でも任意）。
 * `node:crypto` に v7 の生成が無く、domain には外部ライブラリを入れないため自前で作る。
 */
export function generateUuidV7(): string {
  const bytes = randomBytes(16);
  bytes.writeUIntBE(Date.now(), 0, 6);
  // version: 7 バイト目の上位 4 bit を 0111 にする
  bytes.writeUInt8((bytes.readUInt8(6) & 0x0f) | 0x70, 6);
  // variant: 9 バイト目の上位 2 bit を 10 にする
  bytes.writeUInt8((bytes.readUInt8(8) & 0x3f) | 0x80, 8);

  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}
