import { AccountId } from "../../account/value-objects/AccountId";
import { ProjectPhase } from "../../project/value-objects/ProjectPhase";
import { type Result, err, ok } from "../../shared/result";
import type { LeaderApplicationStateError } from "../errors/LeaderApplicationError";
import { LeaderApplicationId } from "../value-objects/LeaderApplicationId";
import { LeaderApplicationStatus } from "../value-objects/LeaderApplicationStatus";
import { ProjectDraft } from "../value-objects/ProjectDraft";

/**
 * 却下理由の文字数上限（次回ミーティングで再確認。Phase 1 仮値 2000 文字）
 */
const MAX_REVIEWER_NOTE_LENGTH = 2000;

/**
 * LeaderApplication 集約ルート
 *
 * リーダー応募を表すドメインエンティティ。
 *
 * - `PENDING` / `APPROVED` / `REJECTED` の 3 状態を持つ
 * - 終状態（APPROVED / REJECTED）からの再遷移は禁止
 * - 状態遷移は `approve()` / `reject()` メソッド経由でのみ行う
 * - 不変条件は静的ファクトリ（`submit()` / `reconstruct()`）で強制する
 * - 集約の外に露出するのは readonly getter のみ
 *
 * 参照: `アカウント.md` 「リーダー応募（LeaderApplication）」
 */
export class LeaderApplication {
  private constructor(
    private readonly _id: LeaderApplicationId,
    private readonly _accountId: AccountId,
    private _status: LeaderApplicationStatus,
    private readonly _projectDraft: ProjectDraft,
    private readonly _progress: ProjectPhase,
    private readonly _submittedAt: Date,
    private _reviewedAt: Date | null,
    private _reviewerNote: string | null
  ) {}

  /**
   * 新規応募を作成する（`SubmitLeaderApplicationUseCase` から呼び出される）。
   *
   * - 状態は `PENDING` で固定
   * - `submittedAt` は呼び出し時点の時刻（テスタビリティのため引数で上書き可能）
   * - `reviewedAt` / `reviewerNote` は null
   * - `progress` は応募者が選択する 5 値の `ProjectPhase`（PR3 で追加）。
   *   省略時はマイグレーションの DEFAULT に揃え `PLANNING` をフォールバックに用いる。
   */
  static submit(input: {
    accountId: AccountId;
    projectDraft: ProjectDraft;
    /** 進捗フェーズ（応募時に選択。省略時は PLANNING）。 */
    progress?: ProjectPhase;
    /** 省略時は `new Date()`。テスト用に注入可能。 */
    submittedAt?: Date;
    /** 省略時は `LeaderApplicationId.generate()`。 */
    id?: LeaderApplicationId;
  }): LeaderApplication {
    return new LeaderApplication(
      input.id ?? LeaderApplicationId.generate(),
      input.accountId,
      LeaderApplicationStatus.PENDING,
      input.projectDraft,
      input.progress ?? ProjectPhase.PLANNING,
      input.submittedAt ?? new Date(),
      null,
      null
    );
  }

  /**
   * 永続化層から LeaderApplication を復元する。
   *
   * Repository 実装がこのメソッドを使う。状態遷移のルールは適用せず、
   * DB に保存されている値をそのまま復元する（信頼境界は Repository 側）。
   *
   * `progress` は PR3 で追加された必須フィールド。後方互換性のため省略可とし、
   * 省略時は `PLANNING` をフォールバックする（migration の DEFAULT と一致）。
   */
  static reconstruct(input: {
    id: LeaderApplicationId;
    accountId: AccountId;
    status: LeaderApplicationStatus;
    projectDraft: ProjectDraft;
    progress?: ProjectPhase;
    submittedAt: Date;
    reviewedAt: Date | null;
    reviewerNote: string | null;
  }): LeaderApplication {
    return new LeaderApplication(
      input.id,
      input.accountId,
      input.status,
      input.projectDraft,
      input.progress ?? ProjectPhase.PLANNING,
      input.submittedAt,
      input.reviewedAt,
      input.reviewerNote
    );
  }

  // ---- Getters ----

  get id(): LeaderApplicationId {
    return this._id;
  }

  get accountId(): AccountId {
    return this._accountId;
  }

  get status(): LeaderApplicationStatus {
    return this._status;
  }

  get projectDraft(): ProjectDraft {
    return this._projectDraft;
  }

  /**
   * 応募時に選択された進捗フェーズ（PR3 で追加）。
   * 承認時の Project 自動生成（PR5）で `Project.phase` の初期値にコピーされる。
   */
  get progress(): ProjectPhase {
    return this._progress;
  }

  get submittedAt(): Date {
    return this._submittedAt;
  }

  get reviewedAt(): Date | null {
    return this._reviewedAt;
  }

  get reviewerNote(): string | null {
    return this._reviewerNote;
  }

  // ---- State transitions ----

  /**
   * 応募を承認する。
   *
   * - 現在 `PENDING` でない場合はエラー（冪等性確保 / 終状態不可逆）
   * - `reviewedAt` を設定
   * - `reviewerNote` は任意（承認時は通常不要）
   */
  approve(input?: { reviewedAt?: Date }): Result<void, LeaderApplicationStateError> {
    if (this._status !== LeaderApplicationStatus.PENDING) {
      return err({
        type: "CANNOT_APPROVE_NON_PENDING",
        currentStatus: this._status,
      });
    }
    this._status = LeaderApplicationStatus.APPROVED;
    this._reviewedAt = input?.reviewedAt ?? new Date();
    return ok(undefined);
  }

  /**
   * 応募を却下する。
   *
   * - 現在 `PENDING` でない場合はエラー
   * - `reviewerNote` は必須（空白のみ / トリム後空はエラー）
   * - `reviewerNote` の文字数上限は `MAX_REVIEWER_NOTE_LENGTH`
   */
  reject(input: {
    reviewerNote: string;
    reviewedAt?: Date;
  }): Result<void, LeaderApplicationStateError> {
    if (this._status !== LeaderApplicationStatus.PENDING) {
      return err({
        type: "CANNOT_REJECT_NON_PENDING",
        currentStatus: this._status,
      });
    }
    const trimmed = input.reviewerNote.trim();
    if (trimmed.length === 0) {
      return err({ type: "REVIEWER_NOTE_REQUIRED" });
    }
    if (trimmed.length > MAX_REVIEWER_NOTE_LENGTH) {
      return err({
        type: "REVIEWER_NOTE_TOO_LONG",
        maxLength: MAX_REVIEWER_NOTE_LENGTH,
        actualLength: trimmed.length,
      });
    }
    this._status = LeaderApplicationStatus.REJECTED;
    this._reviewedAt = input.reviewedAt ?? new Date();
    this._reviewerNote = trimmed;
    return ok(undefined);
  }
}

export const LEADER_APPLICATION_REVIEWER_NOTE_MAX_LENGTH = MAX_REVIEWER_NOTE_LENGTH;
