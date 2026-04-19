import Link from "next/link";
import {
  PrismaLeaderApplicationQueryService,
  PrismaProjectQueryService,
  PrismaOutboxQueryService,
} from "@physifun/infrastructure";

// ADMIN 認証が必要な動的ページのため、ビルド時の静的生成を無効化する
export const dynamic = "force-dynamic";

const leaderApplicationQueryService = new PrismaLeaderApplicationQueryService();
const projectQueryService = new PrismaProjectQueryService();
const outboxQueryService = new PrismaOutboxQueryService();

/**
 * 運営管理トップページ
 */
export default async function AdminTopPage() {
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
        </ul>
      </nav>
    </div>
  );
}
