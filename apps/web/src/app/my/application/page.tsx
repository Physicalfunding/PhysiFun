import { redirect } from "next/navigation";
import { ApplicationStatus } from "@/components/my/ApplicationStatus";
import { getMyLeaderApplicationQueryService } from "@/lib/di/leader-application";
import { getCurrentUserId } from "@/lib/session";

export const metadata = {
  title: "応募状況 | PhysiFun",
  description: "リーダー応募の審査状況を確認できます",
};

/**
 * /my/application - 応募状況ページ（#374）
 *
 * ログインしている本人のロールと最新の応募を、開くたびにサーバー側で DB から読む（JWT にロールは無い。設計書 §5.1）。
 * - リーダー → `/my/projects` へ移す
 * - それ以外 → 審査中・却下・応募なしのどれかを出す
 *
 * 本人以外の応募を読まないよう、必ずセッションのアカウント ID で読む（URL などの ID は使わない。設計書 §6）。
 */
export default async function MyApplicationPage() {
  const accountId = await getCurrentUserId();
  // `/my/*` は proxy.ts の withAuth でログイン済みに限っているが、最後の守りとしてここでも確かめる
  if (!accountId) {
    redirect("/login?callbackUrl=%2Fmy%2Fapplication");
  }

  const status = await getMyLeaderApplicationQueryService().findStatusByAccountId(accountId);
  if (status?.isLeader) {
    redirect("/my/projects");
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">応募状況</h1>
      {/* アカウントが見つからない（null）ときは「応募なし」と同じ表示にする */}
      <ApplicationStatus
        email={status?.email ?? ""}
        application={status?.latestApplication ?? null}
      />
    </div>
  );
}
