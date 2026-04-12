/**
 * アカウント有効化ユースケースのポートインターフェース
 *
 * infrastructure 層で実装される。application 層はこのインターフェースのみに依存する。
 */

/** アカウント有効化に必要な最小限のアカウント情報 */
export interface AccountForActivation {
  id: string;
  status: "PENDING_EMAIL_CONFIRMATION" | "ACTIVE";
  activationTokenExp: Date | null;
}

/** アカウント有効化のためのリポジトリポート */
export interface ActivateAccountPort {
  /** activationToken でアカウントを検索する */
  findByActivationToken(token: string): Promise<AccountForActivation | null>;

  /** アカウントを有効化する（status=ACTIVE, パスワード設定, トークンクリア） */
  activate(params: { accountId: string; passwordHash: string }): Promise<void>;
}

/** パスワードハッシュ化のポート */
export interface PasswordHasher {
  hash(password: string): Promise<string>;
}
