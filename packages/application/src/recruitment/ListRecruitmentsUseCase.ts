import {
  type Result,
  err,
  ok,
  AccountId,
  type ApprovalMode,
  ProjectId,
  type RecruitmentType,
  type SupportRecruitment,
} from "@physifun/domain";
import type { ListRecruitmentsPort } from "./ports/ListRecruitmentsPort";

// ==================== 出力 DTO ====================

/**
 * 日程の DTO
 */
export interface RecruitmentScheduleDTO {
  readonly id: string;
  /** JST のカレンダー日（"YYYY-MM-DD"） */
  readonly date: string;
  /** JST の "HH:00" */
  readonly startTime: string;
  /** JST の "HH:00" */
  readonly endTime: string;
  readonly capacityPerHour: number;
  readonly approvalMode: ApprovalMode;
}

/**
 * 募集の DTO（日程は日付の古い順）
 */
export interface RecruitmentDTO {
  readonly id: string;
  readonly type: RecruitmentType;
  readonly title: string;
  readonly description: string;
  readonly schedules: readonly RecruitmentScheduleDTO[];
}

/**
 * 成功時の出力 DTO（募集は作成日時の古い順）
 */
export interface ListRecruitmentsOutput {
  readonly recruitments: readonly RecruitmentDTO[];
}

// ==================== エラー型 ====================

/**
 * ユースケースのエラー型（判別共用体）
 */
export type ListRecruitmentsError =
  | { readonly type: "INVALID_ACCOUNT_ID" }
  | { readonly type: "INVALID_PROJECT_ID" }
  | { readonly type: "PROJECT_NOT_FOUND" }
  | { readonly type: "NOT_OWNER" };

// ==================== 入力 DTO ====================

/**
 * ユースケースの入力 DTO
 */
export interface ListRecruitmentsInput {
  readonly accountId: string;
  readonly projectId: string;
}

// ==================== ユースケース ====================

/**
 * プロジェクトのサポート募集を日程ごと一覧するユースケース（リーダーの管理画面用）
 *
 * 処理フロー:
 * 1. AccountId / ProjectId VO 生成（入力バリデーション）
 * 2. プロジェクトの存在チェック + オーナー権限チェック
 * 3. 募集を日程ごと取得し、DTO に変換
 */
export class ListRecruitmentsUseCase {
  constructor(private readonly port: ListRecruitmentsPort) {}

  async execute(
    input: ListRecruitmentsInput
  ): Promise<Result<ListRecruitmentsOutput, ListRecruitmentsError>> {
    // 1. AccountId / ProjectId VO 生成（入力バリデーション）
    const accountIdResult = AccountId.from(input.accountId);
    if (!accountIdResult.ok) {
      return err({ type: "INVALID_ACCOUNT_ID" });
    }

    const projectIdResult = ProjectId.from(input.projectId);
    if (!projectIdResult.ok) {
      return err({ type: "INVALID_PROJECT_ID" });
    }

    // 2. プロジェクトの存在チェック + オーナー権限チェック
    const ownerAccountId = await this.port.findProjectOwner(projectIdResult.value);
    if (!ownerAccountId) {
      return err({ type: "PROJECT_NOT_FOUND" });
    }
    if (!ownerAccountId.equals(accountIdResult.value)) {
      return err({ type: "NOT_OWNER" });
    }

    // 3. 取得 + DTO 変換
    const recruitments = await this.port.findByProjectId(projectIdResult.value);
    return ok({ recruitments: recruitments.map(toDTO) });
  }
}

function toDTO(recruitment: SupportRecruitment): RecruitmentDTO {
  return {
    id: recruitment.id.toString(),
    type: recruitment.type,
    title: recruitment.title,
    description: recruitment.description,
    schedules: recruitment.schedules.map((schedule) => ({
      id: schedule.id.toString(),
      date: schedule.date.toString(),
      startTime: schedule.timeRange.start,
      endTime: schedule.timeRange.end,
      capacityPerHour: schedule.capacityPerHour.value,
      approvalMode: schedule.approvalMode,
    })),
  };
}
