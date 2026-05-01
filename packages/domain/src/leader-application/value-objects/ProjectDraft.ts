import { type Result, err, ok } from "../../shared/result";
import {
  type ProjectCategory,
  isProjectCategory,
} from "../../shared/value-objects/ProjectCategory";
import {
  ProjectLocation,
  type ProjectLocationError,
} from "../../shared/value-objects/ProjectLocation";
import { SnsLinks, type SnsLinksError } from "../../shared/value-objects/SnsLinks";

/**
 * ProjectDraft 文字数上限
 *
 * Issue #192 PR3 で仮値を改訂:
 *   - projectTitle:   100 → 60
 *   - projectSummary: 300 → 150
 *   - projectStory:   5000 → 300
 *   - plannedActivities → activityContent: 1000 → 200 （フィールド名も変更）
 *
 * `activityContent` は応募時の「時間（やる気）」枠で必須となる条件付き必須項目。
 * ProjectDraft VO 自体では nullable として保持し、必須化は呼び出し側
 * (SubmitLeaderApplicationUseCase の Zod superRefine) で担保する。
 *
 * NOTE: 旧フィールド名 `plannedActivities` は ApplyForm.tsx (PR4 で再編予定) からの
 * 互換参照を維持するため、`activityContent` の値を別名として併存させる。
 * PR4 で UI が再編されたタイミングで削除する。
 */
const LIMITS = {
  projectTitle: 60,
  projectSummary: 150,
  projectStory: 300,
  activityContent: 200,
} as const;

/**
 * ProjectDraft 値オブジェクト
 *
 * リーダー応募時に記入する「立ち上げたいプロジェクトの企画内容」を表す
 * 集約的な値オブジェクト。LeaderApplication 集約の一部として保持される。
 *
 * - すべての文字列フィールドは前後の空白をトリム後に文字数判定
 * - Markdown フィールド（story）は生の Markdown の文字数で判定
 * - category / location は必須、SNS リンクは任意
 * - activityContent は応募時の TIME 募集枠で必須となる条件付き必須（Zod superRefine 側で担保）。
 *   ProjectDraft 自体は nullable として保持する。
 */
export class ProjectDraft {
  private constructor(
    readonly projectTitle: string,
    readonly projectSummary: string,
    readonly projectStory: string,
    readonly projectCategory: ProjectCategory,
    readonly location: ProjectLocation,
    readonly activityContent: string | null,
    readonly snsLinks: SnsLinks
  ) {}

  static create(input: {
    projectTitle: string;
    projectSummary: string;
    projectStory: string;
    projectCategory: string;
    location: ProjectLocation;
    /** TIME 募集枠で必須。SKILL_ITEM 単独の場合は null。 */
    activityContent?: string | null;
    snsLinks: SnsLinks;
  }): Result<ProjectDraft, ProjectDraftError> {
    const titleResult = normalizeText("projectTitle", input.projectTitle, LIMITS.projectTitle);
    if (!titleResult.ok) return titleResult;

    const summaryResult = normalizeText(
      "projectSummary",
      input.projectSummary,
      LIMITS.projectSummary
    );
    if (!summaryResult.ok) return summaryResult;

    const storyResult = normalizeText("projectStory", input.projectStory, LIMITS.projectStory);
    if (!storyResult.ok) return storyResult;

    let activityContent: string | null = null;
    if (input.activityContent !== null && input.activityContent !== undefined) {
      const trimmed = input.activityContent.trim();
      if (trimmed.length > 0) {
        if (trimmed.length > LIMITS.activityContent) {
          return err({
            type: "TEXT_TOO_LONG",
            field: "activityContent",
            maxLength: LIMITS.activityContent,
            actualLength: trimmed.length,
          });
        }
        activityContent = trimmed;
      }
    }

    if (!isProjectCategory(input.projectCategory)) {
      return err({
        type: "INVALID_PROJECT_CATEGORY",
        value: input.projectCategory,
      });
    }

    return ok(
      new ProjectDraft(
        titleResult.value,
        summaryResult.value,
        storyResult.value,
        input.projectCategory,
        input.location,
        activityContent,
        input.snsLinks
      )
    );
  }

  equals(other: ProjectDraft): boolean {
    return (
      this.projectTitle === other.projectTitle &&
      this.projectSummary === other.projectSummary &&
      this.projectStory === other.projectStory &&
      this.projectCategory === other.projectCategory &&
      this.location.equals(other.location) &&
      this.activityContent === other.activityContent &&
      this.snsLinks.equals(other.snsLinks)
    );
  }
}

export type ProjectDraftTextField =
  | "projectTitle"
  | "projectSummary"
  | "projectStory"
  | "activityContent";

export type ProjectDraftError =
  | {
      readonly type: "REQUIRED_TEXT_EMPTY";
      readonly field: ProjectDraftTextField;
    }
  | {
      readonly type: "TEXT_TOO_LONG";
      readonly field: ProjectDraftTextField;
      readonly maxLength: number;
      readonly actualLength: number;
    }
  | { readonly type: "INVALID_PROJECT_CATEGORY"; readonly value: string }
  // 以下は型の完全性のために存在するが、ProjectDraft の外側で location / snsLinks を
  // 組み立てる際に発生する。ProjectDraft.create() 自体はすでに構築済みの VO を受け取るため
  // 通常は返さない。
  | ProjectLocationError
  | SnsLinksError;

function normalizeText(
  field: ProjectDraftTextField,
  raw: string,
  maxLength: number
): Result<string, ProjectDraftError> {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return err({ type: "REQUIRED_TEXT_EMPTY", field });
  }
  if (trimmed.length > maxLength) {
    return err({
      type: "TEXT_TOO_LONG",
      field,
      maxLength,
      actualLength: trimmed.length,
    });
  }
  return ok(trimmed);
}

/**
 * ProjectDraft の文字数上限（Single Source of Truth）。
 *
 * `plannedActivities` キーは ApplyForm.tsx (PR4 で再編予定) からの後方互換参照のため、
 * 新フィールド `activityContent` の値を別名として併存させる。
 * PR4 マージ時にこの後方互換キーを削除する。
 */
export const PROJECT_DRAFT_LIMITS = {
  ...LIMITS,
  /** @deprecated Use `activityContent`. ApplyForm.tsx 互換のため一時的に残置（PR4 で削除）。 */
  plannedActivities: LIMITS.activityContent,
} as const;
