import type { Result } from "@physifun/domain";

/**
 * 送信するメール 1 通。
 *
 * text はプレーンテキスト本文 (必須)。html は任意のリッチ表現。
 * クライアント側でテキストしか表示できない場合のフォールバックを保証するため、
 * text は常に必須とする。
 */
export interface MailMessage {
  readonly to: string;
  readonly subject: string;
  /** プレーンテキスト本文 (必須) */
  readonly text: string;
  /** HTML 本文 (任意) */
  readonly html?: string;
}

/**
 * メール送信失敗を表すエラー。
 *
 * `retriable` はワーカーのリトライ判定に使う:
 * - `true`  … 一時障害 (429 / 5xx / ネットワーク瞬断)。再試行する
 * - `false` … 永続的失敗 (400 系 / 宛先不正 / 認証失敗)。dead-letter 扱い
 */
export interface MailSendError {
  readonly message: string;
  readonly retriable: boolean;
  readonly cause?: unknown;
}

/**
 * メール送信アダプタ interface。
 *
 * 実装は `packages/infrastructure/mail/` 配下に追加する
 * (例: ResendMailSender / NoopMailSender / InMemoryMailSender for tests)。
 * アプリケーション層はこの interface のみに依存する。
 */
export interface MailSender {
  send(message: MailMessage): Promise<Result<void, MailSendError>>;
}
