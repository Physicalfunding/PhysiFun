import { randomUUID } from "node:crypto";
import type { OutboxProcessor } from "./types";

/**
 * Outbox メッセージの永続化デリゲート（#226 で Kysely 化・型を厳格化）。
 *
 * 旧実装は Prisma model delegate（`findMany` / `update` / `updateMany`）を
 * `Record<string, unknown>` で緩く受けていたが、claim を `FOR UPDATE SKIP LOCKED`
 * ベースの atomic claim へ置き換えたのに伴い、以下の 2 操作に集約・型付けした。
 */
export interface OutboxDelegate {
  /**
   * 送信候補を atomic に claim し、claim できた行だけを返す。
   *
   * 実装（Kysely）は単一トランザクション内で
   *   `SELECT ... FOR UPDATE SKIP LOCKED` → `UPDATE ... SET claimedAt/By RETURNING *`
   * を行うことで、他ワーカーが掴んでいる行をスキップしつつ二重 claim を防ぐ。
   *
   * 条件:
   * - sentAt IS NULL / deadLetteredAt IS NULL
   * - nextRetryAt IS NULL OR nextRetryAt <= now
   * - claimedAt IS NULL OR claimedAt < claimExpiry
   * createdAt 昇順・最大 batchSize 件。
   */
  claimBatch(params: {
    now: Date;
    claimExpiry: Date;
    claimToken: string;
    batchSize: number;
  }): Promise<OutboxRow[]>;

  /** 1 行を更新する（送信完了 / 失敗 / dead-letter / claim 解放）。 */
  update(id: string, patch: OutboxUpdate): Promise<void>;
}

/** Outbox 行の更新パッチ（指定したフィールドのみ更新する）。 */
export interface OutboxUpdate {
  /** 送信完了時刻。 */
  sentAt?: Date;
  /**
   * 試行回数（絶対値）。claim 中は他ワーカーが触れないため、
   * 取得時の attempts + 1 を渡せば increment と等価。
   */
  attempts?: number;
  lastError?: string;
  nextRetryAt?: Date | null;
  deadLetteredAt?: Date;
  /** claim を解放する（claimedAt = null, claimedBy = null）。 */
  releaseClaim?: boolean;
}

/** claim 済み Outbox 行の共通型 */
export interface OutboxRow {
  id: string;
  type: string;
  payload: unknown;
  createdAt: Date;
  sentAt: Date | null;
  attempts: number;
  lastError: string | null;
  nextRetryAt: Date | null;
  deadLetteredAt: Date | null;
}

/** リトライ回数の上限。超過したら dead-letter 扱い */
const DEFAULT_MAX_ATTEMPTS = 10;
/** claim の有効期限。これより古い claim は別ワーカーが再 claim 可能 */
const DEFAULT_CLAIM_TIMEOUT_MS = 5 * 60 * 1000; // 5 分

export interface OutboxWorkerOptions {
  batchSize?: number;
  baseBackoffSeconds?: number;
  maxAttempts?: number;
  /**
   * claim の有効期限 (ミリ秒)。
   * プロセッサがクラッシュ等で claim を解放しないまま終了した場合の回収用。
   * 最も遅いプロセッサの実行時間より十分長くすること。デフォルト 5 分。
   */
  claimTimeoutMs?: number;
}

/**
 * Outbox ワーカー基底クラス。
 *
 * `tick()` を呼ぶと未送信メッセージを atomic に claim し、
 * 登録済みの OutboxProcessor にディスパッチする。
 *
 * 失敗時は attempts をインクリメントし、exponential backoff で nextRetryAt を設定する。
 *
 * **claim/lock 機構** (#226 で `FOR UPDATE SKIP LOCKED` ベースへ):
 * 並行実行時の二重処理を防ぐため、`delegate.claimBatch()` が単一トランザクション内で
 * 候補を `FOR UPDATE SKIP LOCKED` で確保し、claimedAt/claimedBy を set して返す。
 * 他ワーカーが claim 済みの行はロックをスキップされるため二重 claim されない。
 *
 * 処理完了後 (成功/失敗) に claim を解放する。プロセスがクラッシュした場合は claim が
 * 残留するが、`claimTimeoutMs` 経過後に別ワーカーが再 claim できる。
 */
export class OutboxWorkerBase {
  private readonly processors: Map<string, OutboxProcessor>;
  private readonly batchSize: number;
  private readonly baseBackoffSeconds: number;
  private readonly maxAttempts: number;
  private readonly claimTimeoutMs: number;

  constructor(
    private readonly delegate: OutboxDelegate,
    processors: OutboxProcessor[],
    options?: OutboxWorkerOptions
  ) {
    this.processors = new Map(processors.map((p) => [p.type, p]));
    this.batchSize = options?.batchSize ?? 20;
    this.baseBackoffSeconds = options?.baseBackoffSeconds ?? 30;
    this.maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.claimTimeoutMs = options?.claimTimeoutMs ?? DEFAULT_CLAIM_TIMEOUT_MS;
  }

  /**
   * 未送信メッセージを 1 バッチ分処理する。
   */
  async tick(): Promise<void> {
    const now = new Date();
    const claimToken = randomUUID();
    const claimExpiry = new Date(now.getTime() - this.claimTimeoutMs);

    // atomic claim（FOR UPDATE SKIP LOCKED）で自分が確保できた行だけを取得
    const claimed = await this.delegate.claimBatch({
      now,
      claimExpiry,
      claimToken,
      batchSize: this.batchSize,
    });

    for (const msg of claimed) {
      try {
        const processor = this.processors.get(msg.type);

        if (!processor) {
          // 未知のメッセージ種別 — dead-letter 化して再処理を防止
          await this.delegate.update(msg.id, {
            attempts: msg.attempts + 1,
            lastError: `未知のメッセージ種別: ${msg.type}`,
            deadLetteredAt: new Date(),
            releaseClaim: true,
          });
          continue;
        }

        const result = await processor.process({
          id: msg.id,
          type: msg.type,
          payload: msg.payload,
          createdAt: msg.createdAt,
          sentAt: msg.sentAt,
          attempts: msg.attempts,
          lastError: msg.lastError,
          nextRetryAt: msg.nextRetryAt,
          deadLetteredAt: msg.deadLetteredAt,
        });

        if (result.ok) {
          // 成功: sentAt を記録 + claim 解放
          await this.delegate.update(msg.id, {
            sentAt: new Date(),
            releaseClaim: true,
          });
        } else {
          // 失敗: attempts インクリメント + backoff 計算 + claim 解放
          const newAttempts = msg.attempts + 1;
          const isDeadLetter = !result.error.retriable || newAttempts >= this.maxAttempts;
          const nextRetryAt = isDeadLetter ? null : this.calculateNextRetry(newAttempts);

          await this.delegate.update(msg.id, {
            attempts: newAttempts,
            lastError: result.error.message,
            nextRetryAt,
            releaseClaim: true,
            ...(isDeadLetter ? { deadLetteredAt: new Date() } : {}),
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const newAttempts = msg.attempts + 1;
        const isDeadLetter = newAttempts >= this.maxAttempts;
        const nextRetryAt = isDeadLetter ? null : this.calculateNextRetry(newAttempts);

        try {
          await this.delegate.update(msg.id, {
            attempts: newAttempts,
            lastError: `unexpected: ${errorMessage}`,
            nextRetryAt,
            releaseClaim: true,
            ...(isDeadLetter ? { deadLetteredAt: new Date() } : {}),
          });
        } catch {
          // update 自体が失敗した場合、claim は claimTimeoutMs 経過後に
          // 別ワーカーが再 claim する fallback に任せる
        }
      }
    }
  }

  /**
   * Exponential backoff で次回リトライ時刻を算出する。
   * delay = baseBackoffSeconds * 2^(attempts - 1) 秒
   */
  private calculateNextRetry(attempts: number): Date {
    const delaySeconds = this.baseBackoffSeconds * Math.pow(2, attempts - 1);
    return new Date(Date.now() + delaySeconds * 1000);
  }
}
