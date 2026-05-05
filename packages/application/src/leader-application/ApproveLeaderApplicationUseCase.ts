import { randomUUID } from "node:crypto";
import {
  AccountId,
  type LeaderApplication,
  Project,
  ProjectId,
  ProjectLocation,
  type Result,
  err,
  ok,
} from "@physifun/domain";
import type { ApproveLeaderApplicationPort } from "./ports/ApproveLeaderApplicationPort";
import type { AccountRole } from "../shared/AccountRole";

// ==================== Outbox メッセージ種別 ====================

/**
 * リーダー応募承認時に書き込まれる LeaderApplicationOutboxMessage の type 定数。
 * 対応 processor: `LeaderApplicationApprovedNotifyProcessor` (#187)
 */
export const LEADER_APPLICATION_APPROVED_NOTIFY_TYPE = "approved.notify_applicant" as const;

// ==================== 出力 DTO ====================

/**
 * 成功時の出力 DTO
 */
export interface ApproveLeaderApplicationOutput {
  readonly applicationId: string;
  readonly accountId: string;
  /**
   * 承認時に自動生成された Project の ID（Issue #192 PR5）。
   */
  readonly projectId: string;
}

// ==================== エラー型 ====================

/**
 * ユースケースのエラー型（判別共用体）
 *
 * NOTE: Issue #192 PR5 で `ALREADY_LEADER` を撤去した。重複承認時は
 * roles 更新をスキップし、新規 Project は作成する仕様に変更している。
 */
export type ApproveLeaderApplicationError =
  | { readonly type: "INVALID_REVIEWER_ID" }
  | { readonly type: "APPLICATION_NOT_FOUND" }
  | { readonly type: "ACCOUNT_NOT_FOUND" }
  | { readonly type: "NOT_PENDING" }
  | { readonly type: "REVIEWER_NOT_FOUND" }
  | { readonly type: "PROJECT_MAPPING_FAILED"; readonly reason: string };

// ==================== 入力 DTO ====================

/**
 * ユースケースの入力 DTO
 */
export interface ApproveLeaderApplicationInput {
  readonly applicationId: string;
  readonly reviewerId: string;
}

// ==================== ユースケース ====================

/**
 * リーダー応募を承認するユースケース
 *
 * 処理フロー（単一 DB トランザクション）:
 * 1. reviewer の存在確認（AdminAccount ACTIVE チェック、二重防御）
 * 2. 前提条件チェック:
 *    - LeaderApplication.status === "PENDING"
 *    - 対応する Account レコードが存在する
 * 3. LeaderApplication.status を APPROVED に更新
 * 4. Account.roles に LEADER を追加（既に LEADER の場合は変更なしで pass-through）
 * 5. **Issue #192 PR5**: 応募内容から初期 Project（DRAFT）を 1 件生成
 * 6. LeaderApplicationOutboxMessage に approved.notify_applicant タスクを書き込み
 *    （payload に新規 projectId を含む）
 * 7. トランザクションをコミット
 *
 * Edge cases:
 * - **重複承認**（Account.roles に既に LEADER あり）:
 *   roles 更新をスキップしつつ、Project は新規作成する。
 *   旧仕様の `ALREADY_LEADER` エラーは Issue #192 PR5 で撤廃。
 * - **必須項目欠落**: 応募時 PR3 のバリデーション通過後の承認なので原則発生しないが、
 *   Project マッピング時に何かが想定外で失敗した場合は `PROJECT_MAPPING_FAILED` を
 *   返してトランザクションをロールバックする。
 */
export class ApproveLeaderApplicationUseCase {
  constructor(private readonly port: ApproveLeaderApplicationPort) {}

  async execute(
    input: ApproveLeaderApplicationInput
  ): Promise<Result<ApproveLeaderApplicationOutput, ApproveLeaderApplicationError>> {
    // 0. reviewerId の UUID 形式バリデーション
    const reviewerIdResult = AccountId.from(input.reviewerId);
    if (!reviewerIdResult.ok) {
      return err({ type: "INVALID_REVIEWER_ID" });
    }

    // 1. reviewer (AdminAccount) の存在確認（Route 層と二重防御）
    // NOTE: この検証はトランザクション外で実行される（TOCTOU の可能性があるが、
    // AdminAccount の無効化は極めて稀なため、project 側と同様に許容する）
    //
    // インフラ側で AdminAccount.status !== "ACTIVE" は null にマップされるため、
    // 「未存在」と「無効化済み」は REVIEWER_NOT_FOUND に集約される。
    const reviewer = await this.port.findAdminReviewerById(input.reviewerId);
    if (!reviewer) {
      return err({ type: "REVIEWER_NOT_FOUND" });
    }

    // 2-a. 応募の存在チェック
    const application = await this.port.findApplicationById(input.applicationId);
    if (!application) {
      return err({ type: "APPLICATION_NOT_FOUND" });
    }

    // 2-b. ドメインエンティティの approve() を呼んで PENDING 状態チェック
    const approveResult = application.approve();
    if (!approveResult.ok) {
      return err({ type: "NOT_PENDING" });
    }

    // 2-c. アカウントの存在チェック
    const account = await this.port.findAccountById(application.accountId.toString());
    if (!account) {
      return err({ type: "ACCOUNT_NOT_FOUND" });
    }

    // 3. LEADER ロール重複時はスキップ（Issue #192 PR5: 重複承認も Project 作成は実行）
    const alreadyLeader = account.roles.includes("LEADER");
    const newRoles: AccountRole[] = alreadyLeader
      ? [...account.roles]
      : [...account.roles, "LEADER"];

    // 4. 応募内容から初期 Project（DRAFT）を構築する
    const projectResult = buildInitialProject(application);
    if (!projectResult.ok) {
      return err({ type: "PROJECT_MAPPING_FAILED", reason: projectResult.error });
    }
    const project = projectResult.value;

    // 5-7. 承認処理をトランザクションで実行
    const now = new Date();
    const outboxMessageId = randomUUID();
    const projectIdStr = project.id.toString();

    await this.port.executeApproval({
      application,
      accountId: account.id,
      newRoles,
      reviewedAt: now,
      project,
      outboxMessage: {
        id: outboxMessageId,
        type: LEADER_APPLICATION_APPROVED_NOTIFY_TYPE,
        payload: {
          applicationId: application.id.toString(),
          accountId: account.id,
          email: account.email,
          // Issue #192 PR5: 通知メールの CTA URL（/my/projects/[id]）に使用
          projectId: projectIdStr,
        },
      },
    });

    return ok({
      applicationId: application.id.toString(),
      accountId: account.id,
      projectId: projectIdStr,
    });
  }
}

// ==================== Project 初期値マッピング ====================

/**
 * 承認された LeaderApplication から初期 Project（DRAFT）を組み立てる。
 *
 * Issue #192 のマッピング表:
 *   id              → uuid 新規発行
 *   ownerAccountId  → application.accountId
 *   slug            → null（公開申請時に発行）
 *   title           → projectTitle
 *   summary         → projectSummary
 *   story (body)    → projectStory
 *   coverImageUrl   → null
 *   category        → projectCategory
 *   prefectureCode  → location.prefectureCode
 *   municipality    → location.municipality
 *   snsLinks        → snsLinks
 *   activityPlan    → activityContent (TIME 含む場合のみ。それ以外は null)
 *   leaderIntro     → null
 *   status          → DRAFT
 *   phase           → progress
 *
 * NOTE: `Project.reconstruct` を使うのは、`Project.createDraft` は VISION/DRAFT 固定で
 * フィールドの初期値を細かく指定できないため。Project 自体は新規だが、新規でも
 * 「特定の初期値を持つ Project」を生成するには reconstruct が適している。
 */
function buildInitialProject(application: LeaderApplication): Result<Project, string> {
  const draft = application.projectDraft;

  // ProjectLocation を再構築（draft.location と同等の値だが Project 用に独立した VO として扱う）
  const locationResult = ProjectLocation.create({
    prefectureCode: draft.location.prefectureCode,
    municipality: draft.location.municipality,
  });
  if (!locationResult.ok) {
    return err(`invalid project location: ${JSON.stringify(locationResult.error)}`);
  }

  // activityPlan は TIME 募集枠の `activityContent` 由来。
  // SubmitLeaderApplicationUseCase は TIME を含まない応募で activityContent を null に
  // 正規化する（normalizeOptional 経由）ため、ProjectDraft.activityContent をそのまま
  // コピーすれば Issue #192 の「TIME 含む場合のみマップ。それ以外は null」と等価になる。
  const activityPlan = draft.activityContent;

  const now = new Date();

  return ok(
    Project.reconstruct({
      id: ProjectId.generate(),
      ownerAccountId: application.accountId,
      title: draft.projectTitle,
      coverImageUrl: null,
      category: draft.projectCategory,
      location: locationResult.value,
      phase: application.progress,
      publishStatus: "DRAFT",
      summary: draft.projectSummary,
      body: draft.projectStory,
      leaderIntroduction: null,
      snsLinks: draft.snsLinks,
      activityPlan,
      createdAt: now,
      updatedAt: now,
    })
  );
}
