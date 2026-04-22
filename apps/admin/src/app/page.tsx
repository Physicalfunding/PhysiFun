import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedAdminId } from "@/lib/api/auth";
import {
  getLeaderApplicationQueryService,
  getOutboxQueryService,
  getProjectQueryService,
} from "@/lib/di/queryServices";

// ADMIN 認証必須 + 常に最新状態を表示するため force-dynamic を明示（ビルド時の静的生成を無効化）
export const dynamic = "force-dynamic";

/**
 * 運営管理トップページ
 *
 * ## 認可 (#147 C-1)
 * ACTIVE な AdminAccount 以外は参照不可。`getAuthenticatedAdminId` は
 * NextAuth v4 Database 戦略経由で AdminSession 行 + AdminAccount.status === ACTIVE
 * の両方を DB で検証する契約のため、null が返った時点で非 ACTIVE / 未ログインが
 * 確定する (#145 / #157)。middleware は Cookie 有無しか見ないため、最終防衛は
 * RSC 側で行う。
 */
export default async function AdminTopPage() {
  const adminId = await getAuthenticatedAdminId();
  if (!adminId) {
    redirect("/login");
  }

  const leaderApplicationQueryService = getLeaderApplicationQueryService();
  const projectQueryService = getProjectQueryService();
  const outboxQueryService = getOutboxQueryService();
  const [pendingApplicationCount, pendingProjectCount, outboxIncompleteCount] = await Promise.all([
    leaderApplicationQueryService.countByStatus("PENDING"),
    projectQueryService.countByStatus("PENDING_REVIEW"),
    Promise.all([
      outboxQueryService.countIncomplete("leaderApplication"),
      outboxQueryService.countIncomplete("project"),
    ]).then(([a, b]) => a + b),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold">運営管理</h1>
      <p className="mt-4 text-gray-600">フィジファン運営管理画面です。</p>

      <nav className="mt-8">
        <ul className="space-y-3">
          <li>
            <Link
              href="/applications"
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-300 hover:shadow-md"
            >
              <div>
                <span className="text-lg font-medium">リーダー応募管理</span>
                <p className="mt-1 text-sm text-gray-500">
                  リーダー応募の審査・承認・却下を行います
                </p>
              </div>
              {pendingApplicationCount > 0 && (
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-yellow-500 px-2 text-xs font-bold text-white">
                  {pendingApplicationCount}
                </span>
              )}
            </Link>
          </li>
          <li>
            <Link
              href="/projects"
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-300 hover:shadow-md"
            >
              <div>
                <span className="text-lg font-medium">プロジェクト審査管理</span>
                <p className="mt-1 text-sm text-gray-500">
                  プロジェクト公開申請の審査・承認・差戻・強制非公開を行います
                </p>
              </div>
              {pendingProjectCount > 0 && (
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-yellow-500 px-2 text-xs font-bold text-white">
                  {pendingProjectCount}
                </span>
              )}
            </Link>
          </li>
          <li>
            <Link
              href="/outbox"
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-300 hover:shadow-md"
            >
              <div>
                <span className="text-lg font-medium">Outbox 監視</span>
                <p className="mt-1 text-sm text-gray-500">
                  メッセージ配信の状況確認・手動リトライ・手動完了を行います
                </p>
              </div>
              {outboxIncompleteCount > 0 && (
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-orange-500 px-2 text-xs font-bold text-white">
                  {outboxIncompleteCount}
                </span>
              )}
            </Link>
          </li>
          <li>
            <Link
              href="/members"
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-300 hover:shadow-md"
            >
              <div>
                <span className="text-lg font-medium">運営メンバー管理</span>
                <p className="mt-1 text-sm text-gray-500">
                  運営アカウントの追加・無効化・再有効化を行います
                </p>
              </div>
            </Link>
          </li>
          <li>
            <Link
              href="/audit-logs"
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-300 hover:shadow-md"
            >
              <div>
                <span className="text-lg font-medium">運営操作履歴</span>
                <p className="mt-1 text-sm text-gray-500">
                  AdminAuditLog の閲覧・フィルタ (運営者 / action / 日付範囲) を行います
                </p>
              </div>
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}
