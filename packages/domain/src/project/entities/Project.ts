import type { AccountId } from "../../account/value-objects/AccountId";
import type { ProjectCategory } from "../../shared/value-objects/ProjectCategory";
import { isProjectCategory } from "../../shared/value-objects/ProjectCategory";
import type { ProjectLocation } from "../../shared/value-objects/ProjectLocation";
import { SnsLinks } from "../../shared/value-objects/SnsLinks";
import { type Result, err, ok } from "../../shared/result";
import type { ProjectStateError, ProjectUpdateError } from "../errors/ProjectError";
import { ProjectId } from "../value-objects/ProjectId";
import { ProjectPhase } from "../value-objects/ProjectPhase";
import { PublishStatus } from "../value-objects/PublishStatus";

/**
 * フィールド文字数上限（プロジェクト.md 仮値）
 */
const LIMITS = {
  title: 100,
  summary: 300,
  body: 10000,
  leaderIntroduction: 2000,
  activityPlan: 1000,
} as const;

/**
 * 公開時に必須のフィールド名
 */
type PublicationRequiredField =
  | "coverImageUrl"
  | "category"
  | "location"
  | "summary"
  | "body"
  | "leaderIntroduction";

/**
 * Project 集約ルート
 *
 * リーダーが作成・管理する体験プロジェクト。
 *
 * - `PublishStatus` 3 値（DRAFT / PENDING_REVIEW / PUBLISHED）の状態遷移を管理
 * - `ProjectPhase` は純粋なラベル（遷移バリデーションなし）
 * - DRAFT 保存時は title のみ必須、公開申請時に追加の必須項目チェック
 * - 件数上限（合計 10 件 / PUBLISHED 3 件）は UseCase 側で検証
 * - activityPlan は公開時にも任意（公開必須項目に含まない）
 */
export class Project {
  private constructor(
    private readonly _id: ProjectId,
    private readonly _ownerAccountId: AccountId,
    private _title: string,
    private _coverImageUrl: string | null,
    private _category: ProjectCategory | null,
    private _location: ProjectLocation | null,
    private _phase: ProjectPhase,
    private _publishStatus: PublishStatus,
    private _summary: string | null,
    private _body: string | null,
    private _leaderIntroduction: string | null,
    private _snsLinks: SnsLinks,
    private _activityPlan: string | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  /**
   * 新規 DRAFT プロジェクトを作成する。
   *
   * title は必須（空文字・空白のみ・100文字超はエラー）。
   */
  static createDraft(input: {
    ownerAccountId: AccountId;
    title: string;
    id?: ProjectId;
    createdAt?: Date;
    snsLinks?: SnsLinks;
  }): Result<Project, ProjectUpdateError> {
    const trimmedTitle = input.title.trim();
    if (trimmedTitle.length === 0) {
      return err({ type: "TITLE_REQUIRED" });
    }
    if (trimmedTitle.length > LIMITS.title) {
      return err({
        type: "TITLE_TOO_LONG",
        maxLength: LIMITS.title,
        actualLength: trimmedTitle.length,
      });
    }
    const now = input.createdAt ?? new Date();
    return ok(
      new Project(
        input.id ?? ProjectId.generate(),
        input.ownerAccountId,
        trimmedTitle,
        null,
        null,
        null,
        ProjectPhase.VISION,
        PublishStatus.DRAFT,
        null,
        null,
        null,
        input.snsLinks ?? createEmptySnsLinks(),
        null,
        now,
        now
      )
    );
  }

  /**
   * リーダー応募承認時に DRAFT プロジェクトを作成する。
   *
   * createDraft が VISION/null 固定の最小生成なのに対し、
   * 応募内容から派生した初期値（summary, body, location, phase, snsLinks など）
   * を持つ Project を生成するためのファクトリ。
   *
   * - title は必須（trim/長さチェック）
   * - summary/body/leaderIntroduction/activityPlan は任意。trim 後の長さ上限を検証
   * - publishStatus は DRAFT 固定（公開時必須項目チェックは走らない）
   */
  static createForLeaderApproval(input: {
    id: ProjectId;
    ownerAccountId: AccountId;
    title: string;
    coverImageUrl: string | null;
    category: ProjectCategory | null;
    location: ProjectLocation | null;
    phase: ProjectPhase;
    summary: string | null;
    body: string | null;
    leaderIntroduction: string | null;
    snsLinks: SnsLinks;
    activityPlan: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Result<Project, ProjectUpdateError> {
    const trimmedTitle = input.title.trim();
    if (trimmedTitle.length === 0) {
      return err({ type: "TITLE_REQUIRED" });
    }
    if (trimmedTitle.length > LIMITS.title) {
      return err({
        type: "TITLE_TOO_LONG",
        maxLength: LIMITS.title,
        actualLength: trimmedTitle.length,
      });
    }

    const summary = validateNullableTextStandalone(
      input.summary,
      LIMITS.summary,
      "SUMMARY_TOO_LONG"
    );
    if (!summary.ok) return summary;

    const body = validateNullableTextStandalone(input.body, LIMITS.body, "BODY_TOO_LONG");
    if (!body.ok) return body;

    const intro = validateNullableTextStandalone(
      input.leaderIntroduction,
      LIMITS.leaderIntroduction,
      "LEADER_INTRODUCTION_TOO_LONG"
    );
    if (!intro.ok) return intro;

    const plan = validateNullableTextStandalone(
      input.activityPlan,
      LIMITS.activityPlan,
      "ACTIVITY_PLAN_TOO_LONG"
    );
    if (!plan.ok) return plan;

    return ok(
      new Project(
        input.id,
        input.ownerAccountId,
        trimmedTitle,
        input.coverImageUrl,
        input.category,
        input.location,
        input.phase,
        PublishStatus.DRAFT,
        summary.value,
        body.value,
        intro.value,
        input.snsLinks,
        plan.value,
        input.createdAt,
        input.updatedAt
      )
    );
  }

  /**
   * 永続化層からの復元。
   */
  static reconstruct(input: {
    id: ProjectId;
    ownerAccountId: AccountId;
    title: string;
    coverImageUrl: string | null;
    category: ProjectCategory | null;
    location: ProjectLocation | null;
    phase: ProjectPhase;
    publishStatus: PublishStatus;
    summary: string | null;
    body: string | null;
    leaderIntroduction: string | null;
    snsLinks: SnsLinks;
    activityPlan: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Project {
    return new Project(
      input.id,
      input.ownerAccountId,
      input.title,
      input.coverImageUrl,
      input.category,
      input.location,
      input.phase,
      input.publishStatus,
      input.summary,
      input.body,
      input.leaderIntroduction,
      input.snsLinks,
      input.activityPlan,
      input.createdAt,
      input.updatedAt
    );
  }

  // ---- Getters ----

  get id(): ProjectId {
    return this._id;
  }
  get ownerAccountId(): AccountId {
    return this._ownerAccountId;
  }
  get title(): string {
    return this._title;
  }
  get coverImageUrl(): string | null {
    return this._coverImageUrl;
  }
  get category(): ProjectCategory | null {
    return this._category;
  }
  get location(): ProjectLocation | null {
    return this._location;
  }
  get phase(): ProjectPhase {
    return this._phase;
  }
  get publishStatus(): PublishStatus {
    return this._publishStatus;
  }
  get summary(): string | null {
    return this._summary;
  }
  get body(): string | null {
    return this._body;
  }
  get leaderIntroduction(): string | null {
    return this._leaderIntroduction;
  }
  get snsLinks(): SnsLinks {
    return this._snsLinks;
  }
  get activityPlan(): string | null {
    return this._activityPlan;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  // ---- Update ----

  /**
   * フィールドを更新する（guard-first, write-last）。
   *
   * 全バリデーションを先に通し、失敗時はエンティティを一切変更しない。
   */
  update(input: {
    title?: string;
    coverImageUrl?: string | null;
    category?: string | null;
    location?: ProjectLocation | null;
    phase?: ProjectPhase;
    summary?: string | null;
    body?: string | null;
    leaderIntroduction?: string | null;
    activityPlan?: string | null;
    snsLinks?: SnsLinks;
  }): Result<void, ProjectUpdateError> {
    // ---- Phase 1: Validate all inputs (no mutation) ----

    let newTitle = this._title;
    if (input.title !== undefined) {
      const trimmed = input.title.trim();
      if (trimmed.length === 0) {
        return err({ type: "TITLE_REQUIRED" });
      }
      if (trimmed.length > LIMITS.title) {
        return err({
          type: "TITLE_TOO_LONG",
          maxLength: LIMITS.title,
          actualLength: trimmed.length,
        });
      }
      newTitle = trimmed;
    }

    const newSummary = this.validateNullableText(
      input.summary,
      LIMITS.summary,
      "SUMMARY_TOO_LONG",
      this._summary
    );
    if (!newSummary.ok) return newSummary;

    const newBody = this.validateNullableText(input.body, LIMITS.body, "BODY_TOO_LONG", this._body);
    if (!newBody.ok) return newBody;

    const newIntro = this.validateNullableText(
      input.leaderIntroduction,
      LIMITS.leaderIntroduction,
      "LEADER_INTRODUCTION_TOO_LONG",
      this._leaderIntroduction
    );
    if (!newIntro.ok) return newIntro;

    const newPlan = this.validateNullableText(
      input.activityPlan,
      LIMITS.activityPlan,
      "ACTIVITY_PLAN_TOO_LONG",
      this._activityPlan
    );
    if (!newPlan.ok) return newPlan;

    let newCategory = this._category;
    if (input.category !== undefined) {
      if (input.category === null) {
        newCategory = null;
      } else if (isProjectCategory(input.category)) {
        newCategory = input.category;
      } else {
        return err({ type: "INVALID_CATEGORY", value: input.category });
      }
    }

    const newCoverImageUrl =
      input.coverImageUrl !== undefined ? input.coverImageUrl : this._coverImageUrl;
    const newLocation = input.location !== undefined ? input.location : this._location;
    const newPhase = input.phase !== undefined ? input.phase : this._phase;
    const newSnsLinks = input.snsLinks !== undefined ? input.snsLinks : this._snsLinks;

    // PUBLISHED 状態なら公開必須項目の維持を検証
    if (this._publishStatus === PublishStatus.PUBLISHED) {
      const missing = getMissingPublicationFieldsFrom({
        coverImageUrl: newCoverImageUrl,
        category: newCategory,
        location: newLocation,
        summary: newSummary.value,
        body: newBody.value,
        leaderIntroduction: newIntro.value,
      });
      if (missing.length > 0) {
        return err({ type: "CANNOT_UPDATE_PUBLISHED_MISSING_FIELDS", missingFields: missing });
      }
    }

    // ---- Phase 2: Apply all mutations (all validation passed) ----

    this._title = newTitle;
    this._summary = newSummary.value;
    this._body = newBody.value;
    this._leaderIntroduction = newIntro.value;
    this._activityPlan = newPlan.value;
    this._coverImageUrl = newCoverImageUrl;
    this._category = newCategory;
    this._location = newLocation;
    this._phase = newPhase;
    this._snsLinks = newSnsLinks;
    this._updatedAt = new Date();

    // PENDING_REVIEW 中に編集した場合は自動で DRAFT に戻す
    if (this._publishStatus === PublishStatus.PENDING_REVIEW) {
      this._publishStatus = PublishStatus.DRAFT;
    }

    return ok(undefined);
  }

  // ---- State transitions ----

  /**
   * 公開申請: DRAFT → PENDING_REVIEW
   */
  requestPublish(): Result<void, ProjectStateError> {
    if (this._publishStatus !== PublishStatus.DRAFT) {
      return err({ type: "CANNOT_REQUEST_PUBLISH_NON_DRAFT", currentStatus: this._publishStatus });
    }
    const missing = this.getMissingPublicationFields();
    if (missing.length > 0) {
      return err({ type: "PUBLICATION_REQUIREMENTS_NOT_MET", missingFields: missing });
    }
    this._publishStatus = PublishStatus.PENDING_REVIEW;
    this._updatedAt = new Date();
    return ok(undefined);
  }

  /**
   * 自主取下げ / 保存に伴う自動取下げ: PENDING_REVIEW → DRAFT
   */
  withdraw(): Result<void, ProjectStateError> {
    if (this._publishStatus !== PublishStatus.PENDING_REVIEW) {
      return err({ type: "CANNOT_WITHDRAW_NON_PENDING", currentStatus: this._publishStatus });
    }
    this._publishStatus = PublishStatus.DRAFT;
    this._updatedAt = new Date();
    return ok(undefined);
  }

  /**
   * 運営承認: PENDING_REVIEW → PUBLISHED
   */
  approveByAdmin(): Result<void, ProjectStateError> {
    if (this._publishStatus !== PublishStatus.PENDING_REVIEW) {
      return err({ type: "CANNOT_APPROVE_NON_PENDING", currentStatus: this._publishStatus });
    }
    this._publishStatus = PublishStatus.PUBLISHED;
    this._updatedAt = new Date();
    return ok(undefined);
  }

  /**
   * 運営差戻: PENDING_REVIEW → DRAFT
   */
  rejectByAdmin(): Result<void, ProjectStateError> {
    if (this._publishStatus !== PublishStatus.PENDING_REVIEW) {
      return err({ type: "CANNOT_REJECT_NON_PENDING", currentStatus: this._publishStatus });
    }
    this._publishStatus = PublishStatus.DRAFT;
    this._updatedAt = new Date();
    return ok(undefined);
  }

  /**
   * リーダーが自発的に非公開化: PUBLISHED → DRAFT
   */
  unpublishSelf(): Result<void, ProjectStateError> {
    if (this._publishStatus !== PublishStatus.PUBLISHED) {
      return err({ type: "CANNOT_UNPUBLISH_NON_PUBLISHED", currentStatus: this._publishStatus });
    }
    this._publishStatus = PublishStatus.DRAFT;
    this._updatedAt = new Date();
    return ok(undefined);
  }

  /**
   * 運営による強制非公開: PUBLISHED → DRAFT
   */
  forceUnpublish(): Result<void, ProjectStateError> {
    if (this._publishStatus !== PublishStatus.PUBLISHED) {
      return err({
        type: "CANNOT_FORCE_UNPUBLISH_NON_PUBLISHED",
        currentStatus: this._publishStatus,
      });
    }
    this._publishStatus = PublishStatus.DRAFT;
    this._updatedAt = new Date();
    return ok(undefined);
  }

  // ---- Private helpers ----

  private getMissingPublicationFields(): PublicationRequiredField[] {
    return getMissingPublicationFieldsFrom({
      coverImageUrl: this._coverImageUrl,
      category: this._category,
      location: this._location,
      summary: this._summary,
      body: this._body,
      leaderIntroduction: this._leaderIntroduction,
    });
  }

  /**
   * null 許容テキストフィールドのバリデーション（mutation なし）。
   * undefined → 現在値を返す、null → null、string → trim + 長さチェック。
   */
  private validateNullableText(
    value: string | null | undefined,
    maxLength: number,
    errorType: ProjectUpdateError["type"],
    currentValue: string | null
  ): Result<string | null, ProjectUpdateError> {
    if (value === undefined) return ok(currentValue);
    if (value === null) return ok(null);
    const trimmed = value.trim();
    if (trimmed.length > maxLength) {
      return err({
        type: errorType,
        maxLength,
        actualLength: trimmed.length,
      } as ProjectUpdateError);
    }
    return ok(trimmed.length === 0 ? null : trimmed);
  }
}

/**
 * 静的ファクトリ用の null 許容テキスト検証（mutation なし）。
 * undefined は受け取らない（明示的に null を渡す前提）。
 */
function validateNullableTextStandalone(
  value: string | null,
  maxLength: number,
  errorType: ProjectUpdateError["type"]
): Result<string | null, ProjectUpdateError> {
  if (value === null) return ok(null);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    return err({
      type: errorType,
      maxLength,
      actualLength: trimmed.length,
    } as ProjectUpdateError);
  }
  return ok(trimmed.length === 0 ? null : trimmed);
}

function getMissingPublicationFieldsFrom(fields: {
  coverImageUrl: string | null;
  category: unknown;
  location: unknown;
  summary: string | null;
  body: string | null;
  leaderIntroduction: string | null;
}): PublicationRequiredField[] {
  const missing: PublicationRequiredField[] = [];
  if (!fields.coverImageUrl) missing.push("coverImageUrl");
  if (!fields.category) missing.push("category");
  if (!fields.location) missing.push("location");
  if (!fields.summary) missing.push("summary");
  if (!fields.body) missing.push("body");
  if (!fields.leaderIntroduction) missing.push("leaderIntroduction");
  return missing;
}

function createEmptySnsLinks(): SnsLinks {
  const r = SnsLinks.create({});
  if (!r.ok) throw new Error("unreachable: empty SnsLinks must succeed");
  return r.value;
}

export const PROJECT_LIMITS = LIMITS;
