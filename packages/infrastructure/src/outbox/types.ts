import type { Result } from "@physifun/domain";

/**
 * Outbox メッセージ
 *
 * DB の `leader_application_outbox_messages` / `project_outbox_messages` 行を
 * メモリ表現したもの。ドメインイベントを transactional outbox パターンで
 * 信頼性高く配送するために使う。
 *
 * @typeParam T - payload の型。呼び出し側で具体的なイベント型を指定する。
 */
export interface OutboxMessage<T = unknown> {
  readonly id: string;
  /** ドメイン固有のイベント種別 (例: "LeaderApplicationSubmitted") */
  readonly type: string;
  readonly payload: T;
  readonly createdAt: Date;
  /** 送信完了時刻。null なら未送信。 */
  readonly sentAt: Date | null;
  /** 再試行回数。初期値 0。 */
  readonly attempts: number;
  /** 直近の失敗理由。 */
  readonly lastError: string | null;
  /** 次回再試行予定時刻。null なら即時実行可。 */
  readonly nextRetryAt: Date | null;
}

/**
 * Outbox 処理失敗を表す基底エラー。
 *
 * 各ドメイン固有の OutboxProcessor 実装が具体化する。
 *
 * `retriable` はワーカーのリトライ判定に使う:
 * - `true`  … 一時障害 (ネットワーク瞬断 / 429 / 5xx など)。attempts を増やして nextRetryAt を設定
 * - `false` … 永続的失敗 (バリデーション違反 / 4xx など)。dead-letter 扱いにして再試行しない
 */
export interface OutboxProcessError {
  readonly message: string;
  readonly retriable: boolean;
  readonly cause?: unknown;
}

/**
 * Outbox メッセージを処理する副作用アダプタ。
 *
 * 実装例: メール送信、外部 API 通知、ログ記録など。
 * 1 メッセージ = 1 処理の単位で、成功時は sentAt を更新する責務はワーカー側に任せる。
 *
 * @typeParam T - 受け付ける payload の型
 */
export interface OutboxProcessor<T = unknown> {
  /**
   * このプロセッサが担当するメッセージ種別。
   * ワーカーは type でディスパッチする。
   */
  readonly type: string;

  /**
   * 1 メッセージを処理する。
   * 失敗時は Result.err を返す (throw しない)。ワーカー側で attempts/nextRetryAt を更新する。
   */
  process(message: OutboxMessage<T>): Promise<Result<void, OutboxProcessError>>;
}
