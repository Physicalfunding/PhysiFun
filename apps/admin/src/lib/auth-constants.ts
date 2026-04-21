/**
 * 運営管理アプリ認証まわりの定数 (#158 M4 / #159 L-1)
 *
 * UI 文言 (verify-request ページの「10 分以内」等) と NextAuth 設定
 * (EmailProvider の maxAge) で同じ値を参照できるよう単一の定数化する。
 *
 * UI 文言を一次情報 (分単位) として定義し、秒は乗算で導出する。
 * こうすることで `Math.floor` による切り捨てバグ (UI は 10 分と表示するが
 * 実際の TTL は 10:59 のような中途半端な値になる) を構造的に回避する。
 */

/** マジックリンクの有効期限 (分) - UI 表示および秒値の一次定義 */
export const EMAIL_MAGIC_LINK_MAX_AGE_MIN = 10;

/** マジックリンクの有効期限 (秒) - NextAuth EmailProvider.maxAge 用 */
export const EMAIL_MAGIC_LINK_MAX_AGE_SEC = EMAIL_MAGIC_LINK_MAX_AGE_MIN * 60;
