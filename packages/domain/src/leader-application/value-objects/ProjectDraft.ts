import { type Result, err, ok } from "../../shared/result";
import { type ProjectCategory, isProjectCategory } from "./ProjectCategory";
import { ProjectLocation, type ProjectLocationError } from "./ProjectLocation";
import { SnsLinks, type SnsLinksError } from "./SnsLinks";

/**
 * ProjectDraft 文字数上限（`アカウント.md` B-3 仮値）
 */
const LIMITS = {
  projectTitle: 100,
  projectSummary: 300,
  projectStory: 5000,
  plannedActivities: 1000,
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
 */
export class ProjectDraft {
  private constructor(
    readonly projectTitle: string,
    readonly projectSummary: string,
    readonly projectStory: string,
    readonly projectCategory: ProjectCategory,
    readonly location: ProjectLocation,
    readonly plannedActivities: string,
    readonly snsLinks: SnsLinks
  ) {}

  static create(input: {
    projectTitle: string;
    projectSummary: string;
    projectStory: string;
    projectCategory: string;
    location: ProjectLocation;
    plannedActivities: string;
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

    const activitiesResult = normalizeText(
      "plannedActivities",
      input.plannedActivities,
      LIMITS.plannedActivities
    );
    if (!activitiesResult.ok) return activitiesResult;

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
        activitiesResult.value,
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
      this.plannedActivities === other.plannedActivities &&
      this.snsLinks.equals(other.snsLinks)
    );
  }
}

export type ProjectDraftTextField =
  | "projectTitle"
  | "projectSummary"
  | "projectStory"
  | "plannedActivities";

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

export const PROJECT_DRAFT_LIMITS = LIMITS;
