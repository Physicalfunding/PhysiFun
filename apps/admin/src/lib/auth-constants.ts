/**
 * 運営管理アプリ認証まわりの定数 (#158 M4)
 *
 * UI 文言 (verify-request ページの「10 分以内」等) と NextAuth 設定
 * (EmailProvider の maxAge) で同じ値を参照できるよう単一の定数化する。
 */

/** マジックリンクの有効期限 (秒) */
export const EMAIL_MAGIC_LINK_MAX_AGE_SEC = 10 * 60;

/** マジックリンクの有効期限 (分) - UI 表示用 */
export const EMAIL_MAGIC_LINK_MAX_AGE_MIN = Math.floor(EMAIL_MAGIC_LINK_MAX_AGE_SEC / 60);
