/**
 * AdminAccount 集約の状態遷移エラー (#140 / #144 / #145 / #148 / #158 L4)
 *
 * 値オブジェクト生成時のフォーマット / 長さバリデーション失敗は
 * 各 value-object の固有エラー型で表現する。本ファイルでは集約ルートの
 * 状態遷移 / 自己操作ガードで起き得るエラーを列挙する。
 *
 * #145 でマジックリンク方式に切替し TOTP 関連エラーは削除した。
 * #148 で「自分自身を無効化できない」ガードを集約に集約 (#158 L4)。
 */
export type AdminAccountStateError =
  | { readonly type: "CANNOT_DISABLE_ALREADY_DISABLED" }
  | { readonly type: "CANNOT_DISABLE_SELF" };
