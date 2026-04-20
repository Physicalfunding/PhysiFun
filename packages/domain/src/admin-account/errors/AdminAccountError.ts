/**
 * AdminAccount 集約の状態遷移エラー (#140 / #144)
 *
 * 値オブジェクト生成時のフォーマット / 長さバリデーション失敗は
 * 各 value-object の固有エラー型で表現する。本ファイルでは集約ルートの
 * 状態遷移で起き得るエラーを列挙する。
 */
export type AdminAccountStateError =
  | { readonly type: "CANNOT_DISABLE_ALREADY_DISABLED" }
  | { readonly type: "CANNOT_ENABLE_TOTP_WITHOUT_SECRET" }
  | { readonly type: "TOTP_ALREADY_ENABLED" }
  | { readonly type: "ACCOUNT_DISABLED" };
