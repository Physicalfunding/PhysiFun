import { AccountId } from "../../account/value-objects/AccountId";
import { ProjectPhase } from "../../project/value-objects/ProjectPhase";
import { type Result, err, ok } from "../../shared/result";
import type { LeaderApplicationStateError } from "../errors/LeaderApplicationError";
import type { LeaderApplicationRecruitmentType } from "../constants";
import { LeaderApplicationId } from "../value-objects/LeaderApplicationId";
import { LeaderApplicationStatus } from "../value-objects/LeaderApplicationStatus";
import { ProjectDraft } from "../value-objects/ProjectDraft";

/**
 * 却下理由の文字数上限（次回ミーティングで再確認。Phase 1 仮値 2000 文字）
 */
const MAX_REVIEWER_NOTE_LENGTH = 2000;

/**
 * 応募スナップショットの追加フィールド (Issue #192 PR3〜PR5)
 *
 * `LeaderApplication` 集約は本来 ProjectDraft で企画情報を保持していたが、
 * 応募フォームの拡張で追加された連絡先・募集タイプ・体験提供文・条件付き必須
 * フィールド群は ProjectDraft のスコープ外であるため、エンティティ側に
 * 「応募時のスナップショット」として保持する。
 *
 * Phase 1 ではドメインロジック（approve / reject）はこれらの値に依存しない
 * （ProjectDraft の不変条件のみで承認可能）が、永続化からの round-trip と
 * 将来の運営画面表示用に reconstruct パスでもエンティティに載せておく。
 */
export interface LeaderApplicationSnapshot {
  readonly phoneNumber: string | null;
  readonly progress: ProjectPhase;
  readonly recruitmentTypes: readonly LeaderApplicationRecruitmentType[];
  readonly experienceOffered: string | null;
  // TIME 募集枠
  readonly eventLocation: string | null;
  readonly eventPeriod: string | null;
  readonly recruitCount: number | null;
  readonly timeReturn: string | null;
  // SKILL_ITEM 募集枠
  readonly skillItemNeeds: string | null;
  readonly skillItemDeadline: string | null;
  readonly skillItemReturn: string | null;
}

const EMPTY_SNAPSHOT: LeaderApplicationSnapshot = {
  phoneNumber: null,
  progress: "PLANNING",
  recruitmentTypes: [],
  experienceOffered: null,
  eventLocation: null,
  eventPeriod: null,
  recruitCount: null,
  timeReturn: null,
  skillItemNeeds: null,
  skillItemDeadline: null,
  skillItemReturn: null,
};

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
    private _reviewerNote: string | null,
    private readonly _snapshot: LeaderApplicationSnapshot
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
    /** 応募スナップショット（連絡先・募集タイプ等）。省略時は EMPTY_SNAPSHOT。 */
    snapshot?: LeaderApplicationSnapshot;
  }): LeaderApplication {
    return new LeaderApplication(
      input.id ?? LeaderApplicationId.generate(),
      input.accountId,
      LeaderApplicationStatus.PENDING,
      input.projectDraft,
      input.progress ?? ProjectPhase.PLANNING,
      input.submittedAt ?? new Date(),
      null,
      null,
      input.snapshot ?? EMPTY_SNAPSHOT
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
    /**
     * 応募スナップショット（PR3〜PR5 で追加された応募フォーム拡張フィールド）。
     * 旧データに未設定の場合は `EMPTY_SNAPSHOT` 同等の null セットを渡してよい。
     */
    snapshot?: LeaderApplicationSnapshot;
  }): LeaderApplication {
    return new LeaderApplication(
      input.id,
      input.accountId,
      input.status,
      input.projectDraft,
      input.progress ?? ProjectPhase.PLANNING,
      input.submittedAt,
      input.reviewedAt,
      input.reviewerNote,
      input.snapshot ?? EMPTY_SNAPSHOT
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

  /**
   * 応募スナップショット（PR3〜PR5 で追加された応募フォーム拡張フィールド一式）。
   *
   * approve / reject ロジックでは参照しないが、永続化からの round-trip 確認や
   * 運営画面での表示に使用するため readonly で公開する。
   */
  get snapshot(): LeaderApplicationSnapshot {
    return this._snapshot;
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
