import { redirect } from "next/navigation";
import { ProjectList } from "@/components/my/projects/ProjectList";
import { getMyLeaderApplicationQueryService } from "@/lib/di/leader-application";
import { getCurrentUserId } from "@/lib/session";

export const metadata = {
  title: "マイプロジェクト | PhysiFun",
  description: "プロジェクトの一覧と管理",
};

/**
 * /my/projects - マイプロジェクト（プロジェクト一覧）
 *
 * リーダー専用。ヘッダーの「マイプロジェクト」はみなここに来るので、リーダーでない人
 * （リーダー応募の審査中・却下）は応募状況（`/my/application`）へ移す（#374・設計書 §5.1）。
 * ロールは JWT に無いので、開くたびにサーバー側で DB から読む。
 */
export default async function MyProjectsPage() {
  const accountId = await getCurrentUserId();
  // `/my/*` は proxy.ts の withAuth でログイン済みに限っているが、最後の守りとしてここでも確かめる
  if (!accountId) {
    redirect("/login?callbackUrl=%2Fmy%2Fprojects");
  }

  const status = await getMyLeaderApplicationQueryService().findStatusByAccountId(accountId);
  if (!status?.isLeader) {
    redirect("/my/application");
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">マイプロジェクト</h1>
      <ProjectList />
    </div>
  );
}
