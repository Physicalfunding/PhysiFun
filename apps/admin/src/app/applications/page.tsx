import Link from "next/link";
import { redirect } from "next/navigation";
import { ApplicationStatusBadge } from "@/components/ApplicationStatusBadge";
import { getAuthenticatedAdminId } from "@/lib/api/auth";
import { getLeaderApplicationQueryService } from "@/lib/di/queryServices";

// NOTE: 運営アプリでは Server Component から infrastructure を直接利用する規約（UseCase/Port 不要）
// ADMIN 認証必須 + 常に最新状態を表示するため force-dynamic を明示（ビルド時の静的生成を無効化）
export const dynamic = "force-dynamic";

const TABS = [
  { status: "PENDING" as const, label: "審査待ち" },
  { status: "APPROVED" as const, label: "承認済み" },
  { status: "REJECTED" as const, label: "却下済み" },
];

/**
 * /applications — リーダー応募一覧
 *
 * ## 認可 (#147 C-1)
 * ACTIVE な AdminAccount 以外は参照不可。middleware の Cookie 判定ではなく
 * RSC 側で `getAuthenticatedAdminId` により AdminSession 行 + AdminAccount.status
 * === ACTIVE を DB で再確認する。null なら /login へリダイレクト。
 */
export default async function ApplicationsListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const adminId = await getAuthenticatedAdminId();
  if (!adminId) {
    redirect("/login");
  }

  const params = await searchParams;
  const currentStatus =
    params.status === "APPROVED" || params.status === "REJECTED" ? params.status : "PENDING";
  const page = Math.max(1, Number(params.page) || 1);
  const perPage = 20;

  const queryService = getLeaderApplicationQueryService();
  const [result, pendingCount, approvedCount, rejectedCount] = await Promise.all([
    queryService.findMany({ status: currentStatus, page, perPage }),
    queryService.countByStatus("PENDING"),
    queryService.countByStatus("APPROVED"),
    queryService.countByStatus("REJECTED"),
  ]);
  const totalPages = Math.ceil(result.totalCount / perPage);
  const countMap: Record<string, number> = {
    PENDING: pendingCount,
    APPROVED: approvedCount,
    REJECTED: rejectedCount,
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">リーダー応募管理</h1>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← トップに戻る
        </Link>
      </div>

      {/* タブ */}
      <div className="mb-6 flex gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <Link
            key={tab.status}
            href={`/applications?status=${tab.status}`}
            className={`px-4 py-2 text-sm font-medium ${
              currentStatus === tab.status
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
            <span
              className={`ml-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                currentStatus === tab.status
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {countMap[tab.status]}
            </span>
          </Link>
        ))}
      </div>

      {/* テーブル */}
      {result.items.length === 0 ? (
        <p className="py-12 text-center text-gray-500">該当する応募はありません</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500">
                  応募日
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500">
                  応募者名
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500">
                  プロジェクトタイトル
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500">
                  ステータス
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {result.items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    <Link href={`/applications/${item.id}`} className="hover:underline">
                      {item.submittedAt.toLocaleDateString("ja-JP")}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <Link href={`/applications/${item.id}`} className="hover:underline">
                      {item.displayName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <Link href={`/applications/${item.id}`} className="font-medium hover:underline">
                      {item.projectTitle}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <ApplicationStatusBadge status={item.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {result.totalCount} 件中 {(page - 1) * perPage + 1}〜
            {Math.min(page * perPage, result.totalCount)} 件
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/applications?status=${currentStatus}&page=${page - 1}`}
                className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
              >
                前へ
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/applications?status=${currentStatus}&page=${page + 1}`}
                className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
              >
                次へ
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
