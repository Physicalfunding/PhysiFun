import { getCurrentUserId } from "@/lib/session";
import { successResponse, unauthorizedResponse, internalErrorResponse } from "@/lib/api/response";

/**
 * 応募状況取得 API
 *
 * ログインユーザーの LeaderApplication を返す。
 * infrastructure 層が未実装のため、ポートのスタブをインラインで定義している。
 */

// TODO: infrastructure 層の実装後、スタブを実際のアダプターに差し替える
interface LeaderApplicationRow {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  projectTitle: string;
  projectSummary: string;
  projectCategory: string;
  submittedAt: string;
}

interface FindLeaderApplicationPort {
  findByAccountId(accountId: string): Promise<LeaderApplicationRow | null>;
}

// TODO: PrismaFindLeaderApplicationAdapter に差し替える
const stubPort: FindLeaderApplicationPort = {
  async findByAccountId(_accountId: string): Promise<LeaderApplicationRow | null> {
    // スタブ: 常に null を返す
    return null;
  },
};

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorizedResponse();
    }

    const application = await stubPort.findByAccountId(userId);

    return successResponse({ application });
  } catch (error) {
    console.error("[api/my/application] GET error:", error);
    return internalErrorResponse();
  }
}
