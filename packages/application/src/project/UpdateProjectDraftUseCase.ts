import {
  type Result,
  err,
  ok,
  AccountId,
  ProjectLocation,
  SnsLinks,
  ProjectPhase,
  PublishStatus,
  ProjectReviewFeedback,
  ReviewAction,
  type ProjectUpdateError,
  isProjectCategory,
} from "@physifun/domain";
import type { UpdateProjectDraftPort } from "./ports/UpdateProjectDraftPort";

// ==================== 出力 DTO ====================

/**
 * 成功時の出力 DTO
 */
export interface UpdateProjectDraftOutput {
  readonly projectId: string;
  readonly withdrawnFromPending: boolean;
}

// ==================== エラー型 ====================

/**
 * ユースケースのエラー型（判別共用体）
 */
export type UpdateProjectDraftError =
  | { readonly type: "INVALID_ACCOUNT_ID" }
  | { readonly type: "PROJECT_NOT_FOUND" }
  | { readonly type: "NOT_OWNER" }
  | { readonly type: "CANNOT_EDIT_PUBLISHED" }
  | { readonly type: "DOMAIN_ERROR"; readonly domainError: ProjectUpdateError }
  | { readonly type: "INVALID_CATEGORY"; readonly value: string }
  | { readonly type: "INVALID_LOCATION"; readonly issues: string[] }
  | { readonly type: "INVALID_SNS_LINKS"; readonly issues: string[] }
  | { readonly type: "INVALID_PHASE"; readonly value: string };

// ==================== 入力 DTO ====================

/**
 * ユースケースの入力 DTO
 */
export interface UpdateProjectDraftInput {
  readonly projectId: string;
  readonly accountId: string;
  readonly title?: string;
  readonly coverImageUrl?: string | null;
  readonly category?: string | null;
  /** Phase 1 では prefectureCode のみ。municipality は将来対応 */
  readonly location?: { prefectureCode: string } | null;
  readonly phase?: string;
  readonly summary?: string | null;
  readonly body?: string | null;
  readonly leaderIntroduction?: string | null;
  readonly activityPlan?: string | null;
  readonly snsLinks?: {
    x?: string | null;
    instagram?: string | null;
    facebook?: string | null;
    website?: string | null;
  };
}

// ==================== ユースケース ====================

/**
 * DRAFT / PENDING_REVIEW 状態のプロジェクトを更新するユースケース
 *
 * 処理フロー:
 * 1. プロジェクトの存在チェック
 * 2. AccountId 生成 + オーナー権限チェック
 * 3. PUBLISHED 状態の編集禁止チェック
 * 4. 入力値オブジェクトの構築（category, location, snsLinks, phase）
 * 5. ドメインエンティティの update() 呼び出し
 * 6. PENDING_REVIEW → DRAFT の自動取下げ検知 + WITHDRAWN フィードバック記録
 * 7. アトミック永続化（project + optional feedback）
 */
export class UpdateProjectDraftUseCase {
  constructor(private readonly port: UpdateProjectDraftPort) {}

  async execute(
    input: UpdateProjectDraftInput
  ): Promise<Result<UpdateProjectDraftOutput, UpdateProjectDraftError>> {
    // 1. プロジェクトの存在チェック
    const project = await this.port.findProjectById(input.projectId);
    if (!project) {
      return err({ type: "PROJECT_NOT_FOUND" });
    }

    // 2. オーナー権限チェック
    const callerIdResult = AccountId.from(input.accountId);
    if (!callerIdResult.ok) {
      return err({ type: "INVALID_ACCOUNT_ID" });
    }
    if (!project.ownerAccountId.equals(callerIdResult.value)) {
      return err({ type: "NOT_OWNER" });
    }

    // 3. PUBLISHED 状態の編集禁止
    if (project.publishStatus === PublishStatus.PUBLISHED) {
      return err({ type: "CANNOT_EDIT_PUBLISHED" });
    }

    // 自動取下げ検知のために現在の publishStatus を記録
    const previousStatus = project.publishStatus;

    // 4. 入力値オブジェクトの構築

    // category
    let category: string | null | undefined;
    if (input.category !== undefined) {
      if (input.category === null) {
        category = null;
      } else if (isProjectCategory(input.category)) {
        category = input.category;
      } else {
        return err({ type: "INVALID_CATEGORY", value: input.category });
      }
    }

    // location
    let location: ProjectLocation | null | undefined;
    if (input.location !== undefined) {
      if (input.location === null) {
        location = null;
      } else {
        const locationResult = ProjectLocation.create({
          prefectureCode: input.location.prefectureCode,
        });
        if (!locationResult.ok) {
          return err({
            type: "INVALID_LOCATION",
            issues: [
              `${locationResult.error.type}: ${
                "value" in locationResult.error
                  ? locationResult.error.value
                  : `max=${locationResult.error.maxLength}, actual=${locationResult.error.actualLength}`
              }`,
            ],
          });
        }
        location = locationResult.value;
      }
    }

    // snsLinks
    let snsLinks: SnsLinks | undefined;
    if (input.snsLinks !== undefined) {
      const snsResult = SnsLinks.create({
        x: input.snsLinks.x,
        instagram: input.snsLinks.instagram,
        facebook: input.snsLinks.facebook,
        website: input.snsLinks.website,
      });
      if (!snsResult.ok) {
        return err({
          type: "INVALID_SNS_LINKS",
          issues: [
            `${snsResult.error.type}: field=${snsResult.error.field}, max=${snsResult.error.maxLength}, actual=${snsResult.error.actualLength}`,
          ],
        });
      }
      snsLinks = snsResult.value;
    }

    // phase
    let phase: ProjectPhase | undefined;
    if (input.phase !== undefined) {
      const validPhases = Object.values(ProjectPhase) as string[];
      if (!validPhases.includes(input.phase)) {
        return err({ type: "INVALID_PHASE", value: input.phase });
      }
      phase = input.phase as ProjectPhase;
    }

    // 5. ドメインエンティティの update() 呼び出し
    const updateResult = project.update({
      title: input.title,
      coverImageUrl: input.coverImageUrl,
      category,
      location,
      phase,
      summary: input.summary,
      body: input.body,
      leaderIntroduction: input.leaderIntroduction,
      activityPlan: input.activityPlan,
      snsLinks,
    });

    if (!updateResult.ok) {
      return err({ type: "DOMAIN_ERROR", domainError: updateResult.error });
    }

    // 6. 自動取下げの検知 + フィードバック記録
    const withdrawnFromPending =
      previousStatus === PublishStatus.PENDING_REVIEW &&
      project.publishStatus === PublishStatus.DRAFT;

    let reviewFeedback: ProjectReviewFeedback | undefined;
    if (withdrawnFromPending) {
      const feedbackResult = ProjectReviewFeedback.create({
        projectId: project.id,
        reviewerId: callerIdResult.value,
        action: ReviewAction.WITHDRAWN,
        note: "自動取下げ: PENDING_REVIEW 中にリーダーが編集を行ったため",
      });
      if (!feedbackResult.ok) {
        throw new Error(`[invariant] Failed to create auto-withdrawal feedback: ${feedbackResult.error.type}`);
      }
      reviewFeedback = feedbackResult.value;
    }

    // 7. アトミック永続化
    await this.port.saveProjectWithOptionalFeedback({
      project,
      reviewFeedback,
    });

    return ok({
      projectId: project.id.toString(),
      withdrawnFromPending,
    });
  }
}
