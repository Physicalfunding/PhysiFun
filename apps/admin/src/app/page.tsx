import Link from "next/link";
import { PrismaLeaderApplicationQueryService } from "@physifun/infrastructure";

const queryService = new PrismaLeaderApplicationQueryService();

/**
 * 運営管理トップページ
 */
export default async function AdminTopPage() {
  const pendingCount = await queryService.countByStatus("PENDING");

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
              {pendingCount > 0 && (
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-yellow-500 px-2 text-xs font-bold text-white">
                  {pendingCount}
                </span>
              )}
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}
