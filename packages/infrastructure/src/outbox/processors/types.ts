/**
 * Outbox Processor が通知先のメールアドレスを解決するためのインターフェース。
 *
 * Processor はドメインのユースケース payload に含まれる accountId からメールアドレスを
 * 取得する必要がある。DB 直接参照の代わりにこの interface を通すことで
 * テスト時の差し替えを容易にする。
 */
export interface AccountEmailLookup {
  findEmailByAccountId(accountId: string): Promise<string | null>;
}
