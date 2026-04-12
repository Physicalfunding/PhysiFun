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
const PUBLICATION_REQUIRED_FIELDS = [
  "coverImageUrl",
  "category",
  "location",
  "summary",
  "body",
  "leaderIntroduction",
] as const;

/**
 * Project 集約ルート
 *
 * リーダーが作成・管理する体験プロジェクト。
 *
 * - `PublishStatus` 3 値（DRAFT / PENDING_REVIEW / PUBLISHED）の状態遷移を管理
 * - `ProjectPhase` は純粋なラベル（遷移バリデーションなし）
 * - DRAFT 保存時は title のみ必須、公開申請時に追加の必須項目チェック
 * - 件数上限（合計 10 件 / PUBLISHED 3 件）は UseCase 側で検証
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
   */
  static createDraft(input: {
    ownerAccountId: AccountId;
    title: string;
    id?: ProjectId;
    createdAt?: Date;
    snsLinks?: SnsLinks;
  }): Project {
    const now = input.createdAt ?? new Date();
    return new Project(
      input.id ?? ProjectId.generate(),
      input.ownerAccountId,
      input.title.trim(),
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

  get id(): ProjectId { return this._id; }
  get ownerAccountId(): AccountId { return this._ownerAccountId; }
  get title(): string { return this._title; }
  get coverImageUrl(): string | null { return this._coverImageUrl; }
  get category(): ProjectCategory | null { return this._category; }
  get location(): ProjectLocation | null { return this._location; }
  get phase(): ProjectPhase { return this._phase; }
  get publishStatus(): PublishStatus { return this._publishStatus; }
  get summary(): string | null { return this._summary; }
  get body(): string | null { return this._body; }
  get leaderIntroduction(): string | null { return this._leaderIntroduction; }
  get snsLinks(): SnsLinks { return this._snsLinks; }
  get activityPlan(): string | null { return this._activityPlan; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  // ---- Update ----

  /**
   * フィールドを更新する。
   *
   * - DRAFT: title のみ必須、他フィールドは null 許容
   * - PUBLISHED: 更新後に公開必須項目が全て満たされていることを検証
   * - PENDING_REVIEW 中の更新は UseCase 側で withdraw() → update() として制御
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
    // title バリデーション
    if (input.title !== undefined) {
      const trimmed = input.title.trim();
      if (trimmed.length === 0) {
        return err({ type: "TITLE_REQUIRED" });
      }
      if (trimmed.length > LIMITS.title) {
        return err({ type: "TITLE_TOO_LONG", maxLength: LIMITS.title, actualLength: trimmed.length });
      }
      this._title = trimmed;
    }

    // テキストフィールドのバリデーション（null 許容）
    const textResult = this.validateAndSetNullableText("summary", input.summary, LIMITS.summary);
    if (textResult && !textResult.ok) return textResult;

    const bodyResult = this.validateAndSetNullableText("body", input.body, LIMITS.body);
    if (bodyResult && !bodyResult.ok) return bodyResult;

    const introResult = this.validateAndSetNullableText(
      "leaderIntroduction",
      input.leaderIntroduction,
      LIMITS.leaderIntroduction
    );
    if (introResult && !introResult.ok) return introResult;

    const planResult = this.validateAndSetNullableText("activityPlan", input.activityPlan, LIMITS.activityPlan);
    if (planResult && !planResult.ok) return planResult;

    // その他のフィールド
    if (input.coverImageUrl !== undefined) this._coverImageUrl = input.coverImageUrl;
    if (input.category !== undefined) {
      this._category = input.category !== null && isProjectCategory(input.category) ? input.category : null;
    }
    if (input.location !== undefined) this._location = input.location;
    if (input.phase !== undefined) this._phase = input.phase;
    if (input.snsLinks !== undefined) this._snsLinks = input.snsLinks;

    // PUBLISHED 状態なら公開必須項目の維持を検証
    if (this._publishStatus === PublishStatus.PUBLISHED) {
      const missing = this.getMissingPublicationFields();
      if (missing.length > 0) {
        return err({ type: "PUBLISHED_REQUIREMENTS_NOT_MET", missingFields: missing });
      }
    }

    this._updatedAt = new Date();
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
      return err({ type: "CANNOT_FORCE_UNPUBLISH_NON_PUBLISHED", currentStatus: this._publishStatus });
    }
    this._publishStatus = PublishStatus.DRAFT;
    this._updatedAt = new Date();
    return ok(undefined);
  }

  // ---- Private helpers ----

  private getMissingPublicationFields(): string[] {
    const missing: string[] = [];
    if (!this._coverImageUrl) missing.push("coverImageUrl");
    if (!this._category) missing.push("category");
    if (!this._location) missing.push("location");
    if (!this._summary) missing.push("summary");
    if (!this._body) missing.push("body");
    if (!this._leaderIntroduction) missing.push("leaderIntroduction");
    return missing;
  }

  private validateAndSetNullableText(
    field: "summary" | "body" | "leaderIntroduction" | "activityPlan",
    value: string | null | undefined,
    maxLength: number
  ): Result<void, ProjectUpdateError> | null {
    if (value === undefined) return null;
    if (value === null) {
      this[`_${field}` as keyof this] = null as never;
      return null;
    }
    const trimmed = value.trim();
    if (trimmed.length > maxLength) {
      const errorType = {
        summary: "SUMMARY_TOO_LONG",
        body: "BODY_TOO_LONG",
        leaderIntroduction: "LEADER_INTRODUCTION_TOO_LONG",
        activityPlan: "ACTIVITY_PLAN_TOO_LONG",
      }[field] as ProjectUpdateError["type"];
      return err({ type: errorType, maxLength, actualLength: trimmed.length } as ProjectUpdateError);
    }
    this[`_${field}` as keyof this] = (trimmed.length === 0 ? null : trimmed) as never;
    return null;
  }
}

function createEmptySnsLinks(): SnsLinks {
  const r = SnsLinks.create({});
  if (!r.ok) throw new Error("unreachable: empty SnsLinks must succeed");
  return r.value;
}

export const PROJECT_LIMITS = LIMITS;
