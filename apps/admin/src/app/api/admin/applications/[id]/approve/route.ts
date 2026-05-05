import { after, type NextRequest } from "next/server";
import {
  ApproveLeaderApplicationUseCase,
  type ApproveLeaderApplicationError,
} from "@physifun/application";
import { PrismaApproveLeaderApplicationAdapter } from "@physifun/infrastructure";
import { isUuidV4 } from "@physifun/domain";
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  notFoundResponse,
  unprocessableEntityResponse,
  conflictResponse,
  internalErrorResponse,
} from "@/lib/api/response";
import { getAuthenticatedAdminId } from "@/lib/api/auth";
import { logAdminAction } from "@/lib/api/auditLog";
import { enforceAdminRateLimit } from "@/lib/rateLimit";
import { getLeaderApplicationOutboxWorker } from "@/lib/di/outbox";

/**
 * POST /api/admin/applications/:id/approve
 *
 * リーダー応募を承認する。ADMIN ロール必須。
 *
 * 認証の注意:
 * - middleware.ts は /api パスを除外しているため、この Route Handler が唯一の認可チェック
 * - 運営認証は `@/lib/api/auth#getAuthenticatedAdminId` で AdminSession 経由の Database 戦略 (#145)
 * - 認証後にレート制限 (adminAccountId 単位 60 req/min) を適用 (#157 H1)
 * - 成功後に AdminAuditLog へ post-hook 書き込み (#157 H2)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // 運営認証は `@/lib/api/auth#getAuthenticatedAdminId` で AdminSession 経由の Database 戦略 (#145)
    const reviewerId = await getAuthenticatedAdminId();
    if (!reviewerId) return unauthorizedResponse();

    const limited = enforceAdminRateLimit("adminAction", reviewerId);
    if (limited) return limited;

    const { id } = await params;

    // UUID 形式バリデーション
    if (!isUuidV4(id)) {
      return validationErrorResponse("無効な応募 ID です", {
        id: ["UUID v4 形式で指定してください"],
      });
    }

    const adapter = new PrismaApproveLeaderApplicationAdapter();
    const useCase = new ApproveLeaderApplicationUseCase(adapter);
    const result = await useCase.execute({ applicationId: id, reviewerId });

    if (!result.ok) {
      return mapApproveError(result.error);
    }

    // #157 H2: 運営オペの監査証跡 (post-hook / 非トランザクショナル)
    await logAdminAction({
      adminAccountId: reviewerId,
      action: "leader_application.approve",
      targetType: "LeaderApplication",
      targetId: result.value.applicationId,
      metadata: { accountId: result.value.accountId, projectId: result.value.projectId },
    });

    // 即時送信トリガー (#187 B 経路): approved.notify_applicant メール
    after(async () => {
      try {
        await getLeaderApplicationOutboxWorker().tick();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[after] applications/approve outbox tick failed:", message);
      }
    });

    return successResponse({
      applicationId: result.value.applicationId,
      accountId: result.value.accountId,
      // 管理 UI のリダイレクト先に使用
      projectId: result.value.projectId,
      // 管理 UI が「すでにリーダーだった」ケースを区別するためのフラグ
      wasAlreadyLeader: result.value.wasAlreadyLeader,
    });
  } catch (e) {
    console.error("[api] admin/applications/[id]/approve POST error:", e);
    return internalErrorResponse();
  }
}

function mapApproveError(error: ApproveLeaderApplicationError) {
  switch (error.type) {
    case "APPLICATION_NOT_FOUND":
      return notFoundResponse("応募");
    case "ACCOUNT_NOT_FOUND":
      return notFoundResponse("アカウント");
    case "NOT_PENDING":
      return unprocessableEntityResponse("この応募は審査待ち状態ではありません");
    case "INVALID_REVIEWER_ID":
      return validationErrorResponse("無効な審査者 ID です", {
        reviewerId: ["UUID v4 形式で指定してください"],
      });
    case "REVIEWER_NOT_FOUND":
      // #157 M3: reviewer が DISABLED に落ちた稀ケース。401 を返して再ログインを促す。
      return unauthorizedResponse();
    case "PROJECT_MAPPING_FAILED":
      // Issue #192 PR5: Project マッピング失敗（応募バリデーション通過後の異常）。
      // クライアントの再試行で解決しないサーバー側の異常状態のため 500 を返す。
      // 内部詳細 (reason) はサーバーログにのみ残し、レスポンスには汎用メッセージを返す。
      console.error(
        "[api] admin/applications/[id]/approve PROJECT_MAPPING_FAILED:",
        error.reason
      );
      return internalErrorResponse("初期プロジェクトの作成に失敗しました");
    case "MAX_PROJECTS_REACHED":
      // Project 件数上限超過（CONFLICT 推奨: 既存リソースの状態と新規作成要求が競合）
      return conflictResponse(
        `リーダーあたりの Project 件数上限（${error.max} 件）に達しています`
      );
    default: {
      const _exhaustive: never = error;
      return internalErrorResponse();
    }
  }
}
