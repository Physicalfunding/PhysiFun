import { randomUUID } from "node:crypto";
import type { OutboxProcessor } from "./types";

/**
 * Outbox メッセージの Prisma delegate インターフェース。
 *
 * Prisma の `leaderApplicationOutboxMessage` / `projectOutboxMessage` のように
 * `findMany` / `update` / `updateMany` を提供するモデルを抽象化する。
 *
 * **NOTE**: `where` / `data` を `Record<string, unknown>` で受けるため、
 * Prisma 固有のクエリ構造 (OR, lte 等) の型安全性はコンパイル時に保証されない。
 * クエリ構造の変更時は `OutboxWorkerBase.tick()` 内の呼び出しを手動で確認すること。
 */
export interface OutboxDelegate {
  findMany(args: {
    where: Record<string, unknown>;
    orderBy: Record<string, "asc" | "desc">;
    take: number;
  }): Promise<OutboxRow[]>;

  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<void>;

  updateMany(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<{ count: number }>;
}

/** Prisma から取得した Outbox 行の共通型 */
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
 * `tick()` を呼ぶと未送信メッセージをポーリングし、
 * 登録済みの OutboxProcessor にディスパッチする。
 *
 * 失敗時は attempts をインクリメントし、exponential backoff で nextRetryAt を設定する。
 *
 * **claim/lock 機構** (#187 PR2 review HIGH 対応):
 * 並行実行時の二重処理を防ぐため、tick() は次の 3 ステップで claim を取得する。
 *
 *   1. 候補行を `findMany` (claim 未取得 or claim 期限切れの行を batchSize 件)
 *   2. `updateMany` で `claimedAt = now, claimedBy = token` を一括 set
 *      WHERE 句に「未 claim or claim 期限切れ」を含めるため、他ワーカーが
 *      claim 済みの行は更新されない (Postgres の updateMany が行単位 atomic)
 *   3. `claimedBy = token` で再 `findMany` し、自分が確保できた行だけを処理
 *
 * 処理完了後 (成功/失敗) に `claimedAt = null, claimedBy = null` で claim を解放する。
 * プロセスがクラッシュした場合は claim が残留するが、`claimTimeoutMs` 経過後に
 * 別ワーカーが再 claim できる。
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
   *
   * 送信条件:
   * - sentAt IS NULL
   * - deadLetteredAt IS NULL
   * - nextRetryAt IS NULL OR nextRetryAt <= now
   * - claimedAt IS NULL OR claimedAt < (now - claimTimeoutMs)
   */
  async tick(): Promise<void> {
    const now = new Date();
    const claimToken = randomUUID();
    const claimExpiry = new Date(now.getTime() - this.claimTimeoutMs);

    // ---------- Step 1: 候補行の特定 ----------
    const candidates = await this.delegate.findMany({
      where: {
        sentAt: null,
        deadLetteredAt: null,
        AND: [
          { OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }] },
          { OR: [{ claimedAt: null }, { claimedAt: { lt: claimExpiry } }] },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: this.batchSize,
    });

    if (candidates.length === 0) {
      return;
    }

    // ---------- Step 2: atomic claim ----------
    // updateMany は Postgres の行単位 atomic 更新になるため、
    // 他ワーカーが既に claim 済みの行は WHERE 不一致で更新されない。
    await this.delegate.updateMany({
      where: {
        id: { in: candidates.map((c) => c.id) },
        sentAt: null,
        deadLetteredAt: null,
        OR: [{ claimedAt: null }, { claimedAt: { lt: claimExpiry } }],
      },
      data: { claimedAt: now, claimedBy: claimToken },
    });

    // ---------- Step 3: 自分が claim できた行だけ取得 ----------
    const claimed = await this.delegate.findMany({
      where: { claimedBy: claimToken, sentAt: null },
      orderBy: { createdAt: "asc" },
      take: this.batchSize,
    });

    // ---------- Step 4: 処理 ----------
    for (const msg of claimed) {
      try {
        const processor = this.processors.get(msg.type);

        if (!processor) {
          // 未知のメッセージ種別 — dead-letter 化して再処理を防止
          await this.delegate.update({
            where: { id: msg.id },
            data: {
              attempts: { increment: 1 },
              lastError: `未知のメッセージ種別: ${msg.type}`,
              deadLetteredAt: new Date(),
              claimedAt: null,
              claimedBy: null,
            },
          });
          continue;
        }

        const outboxMessage = {
          id: msg.id,
          type: msg.type,
          payload: msg.payload,
          createdAt: msg.createdAt,
          sentAt: msg.sentAt,
          attempts: msg.attempts,
          lastError: msg.lastError,
          nextRetryAt: msg.nextRetryAt,
          deadLetteredAt: msg.deadLetteredAt,
        };

        const result = await processor.process(outboxMessage);

        if (result.ok) {
          // 成功: sentAt を記録 + claim 解放
          await this.delegate.update({
            where: { id: msg.id },
            data: {
              sentAt: new Date(),
              claimedAt: null,
              claimedBy: null,
            },
          });
        } else {
          // 失敗: attempts インクリメント + backoff 計算 + claim 解放
          const newAttempts = msg.attempts + 1;
          const isDeadLetter = !result.error.retriable || newAttempts >= this.maxAttempts;
          const nextRetryAt = isDeadLetter ? null : this.calculateNextRetry(newAttempts);

          await this.delegate.update({
            where: { id: msg.id },
            data: {
              attempts: { increment: 1 },
              lastError: result.error.message,
              nextRetryAt,
              claimedAt: null,
              claimedBy: null,
              ...(isDeadLetter ? { deadLetteredAt: new Date() } : {}),
            },
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const newAttempts = msg.attempts + 1;
        const isDeadLetter = newAttempts >= this.maxAttempts;
        const nextRetryAt = isDeadLetter ? null : this.calculateNextRetry(newAttempts);

        try {
          await this.delegate.update({
            where: { id: msg.id },
            data: {
              attempts: { increment: 1 },
              lastError: `unexpected: ${errorMessage}`,
              nextRetryAt,
              claimedAt: null,
              claimedBy: null,
              ...(isDeadLetter ? { deadLetteredAt: new Date() } : {}),
            },
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
