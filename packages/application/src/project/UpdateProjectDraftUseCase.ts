import {
  type Result,
  err,
  ok,
  AccountId,
  ProjectId,
  ProjectLocation,
  SnsLinks,
  type SnsLinksError,
  ProjectPhase,
  PublishStatus,
  type ProjectUpdateError,
  isProjectCategory,
} from "@physifun/domain";
import type { UpdateProjectDraftPort } from "./ports/UpdateProjectDraftPort";

/**
 * SnsLinks の判別共用体エラーを UseCase の issues[] に変換する
 */
function formatSnsLinksError(error: SnsLinksError): string {
  switch (error.type) {
    case "SNS_URL_TOO_LONG":
      return `SNS_URL_TOO_LONG: field=${error.field}, max=${error.maxLength}, actual=${error.actualLength}`;
    case "INVALID_URL_SCHEME":
      return `INVALID_URL_SCHEME: field=${error.field}, allowed=${error.allowedSchemes.join("|")}`;
    default: {
      // 将来 SnsLinksError に variant が追加された場合にコンパイルエラーで気づけるようにする
      const _exhaustive: never = error;
      throw new Error(`Unknown SnsLinksError variant: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

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
  | { readonly type: "INVALID_PROJECT_ID" }
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
  readonly location?: { prefectureCode: string; municipality?: string | null } | null;
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
 * 6. PENDING_REVIEW → DRAFT の自動取下げ検知
 * 7. 永続化
 */
export class UpdateProjectDraftUseCase {
  constructor(private readonly port: UpdateProjectDraftPort) {}

  async execute(
    input: UpdateProjectDraftInput
  ): Promise<Result<UpdateProjectDraftOutput, UpdateProjectDraftError>> {
    // 1. 入力バリデーション
    const projectIdResult = ProjectId.from(input.projectId);
    if (!projectIdResult.ok) {
      return err({ type: "INVALID_PROJECT_ID" });
    }

    const callerIdResult = AccountId.from(input.accountId);
    if (!callerIdResult.ok) {
      return err({ type: "INVALID_ACCOUNT_ID" });
    }

    // 2. プロジェクトの存在チェック
    const project = await this.port.findProjectById(input.projectId);
    if (!project) {
      return err({ type: "PROJECT_NOT_FOUND" });
    }

    // 3. オーナー権限チェック
    if (!project.ownerAccountId.equals(callerIdResult.value)) {
      return err({ type: "NOT_OWNER" });
    }

    // 4. PUBLISHED 状態の編集禁止
    if (project.publishStatus === PublishStatus.PUBLISHED) {
      return err({ type: "CANNOT_EDIT_PUBLISHED" });
    }

    // 自動取下げ検知のために現在の publishStatus を記録
    const previousStatus = project.publishStatus;

    // 5. 入力値オブジェクトの構築

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
          municipality: input.location.municipality,
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
          issues: [formatSnsLinksError(snsResult.error)],
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

    // 6. ドメインエンティティの update() 呼び出し
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

    // 7. 自動取下げの検知
    const withdrawnFromPending =
      previousStatus === PublishStatus.PENDING_REVIEW &&
      project.publishStatus === PublishStatus.DRAFT;

    // 8. 永続化
    await this.port.saveProjectWithOptionalFeedback({ project });

    return ok({
      projectId: project.id.toString(),
      withdrawnFromPending,
    });
  }
}
