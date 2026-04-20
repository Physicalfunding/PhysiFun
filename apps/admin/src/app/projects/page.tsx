import Link from "next/link";
import type { PublishStatus } from "@physifun/domain";
import { ProjectPublishStatusBadge } from "@/components/ProjectPublishStatusBadge";
import { getCategoryLabel } from "@/lib/category";
import { getProjectQueryService } from "@/lib/di/queryServices";
import { getPrefectureName } from "@/lib/prefecture";

// NOTE: 運営アプリでは Server Component から infrastructure を直接利用する規約（UseCase/Port 不要）
// ADMIN 認証必須 + 常に最新状態を表示するため force-dynamic を明示（ビルド時の静的生成を無効化）
export const dynamic = "force-dynamic";

const TABS: { status: PublishStatus; label: string }[] = [
  { status: "PENDING_REVIEW", label: "審査待ち" },
  { status: "DRAFT", label: "下書き" },
  { status: "PUBLISHED", label: "公開中" },
];

const PER_PAGE = 20;

function toPublishStatus(raw: string | undefined): PublishStatus {
  if (raw === "DRAFT" || raw === "PENDING_REVIEW" || raw === "PUBLISHED") {
    return raw;
  }
  return "PENDING_REVIEW";
}

/**
 * /projects — プロジェクト審査一覧
 *
 * PublishStatus でタブ切替する。デフォルトは PENDING_REVIEW。
 */
export default async function AdminProjectsListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const currentStatus = toPublishStatus(params.status);
  const page = Math.max(1, Number(params.page) || 1);

  const queryService = getProjectQueryService();
  // 現在アクティブなタブの count は findManyForAdmin の totalCount を再利用し、他 2 タブのみ countByStatus を発行する
  const otherStatuses = TABS.map((tab) => tab.status).filter((s) => s !== currentStatus);
  const [result, otherCountA, otherCountB] = await Promise.all([
    queryService.findManyForAdmin({ status: currentStatus, page, perPage: PER_PAGE }),
    queryService.countByStatus(otherStatuses[0]),
    queryService.countByStatus(otherStatuses[1]),
  ]);
  const totalPages = Math.ceil(result.totalCount / PER_PAGE);
  const countMap: Record<PublishStatus, number> = {
    DRAFT: 0,
    PENDING_REVIEW: 0,
    PUBLISHED: 0,
  };
  countMap[currentStatus] = result.totalCount;
  countMap[otherStatuses[0]] = otherCountA;
  countMap[otherStatuses[1]] = otherCountB;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">プロジェクト審査管理</h1>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← トップに戻る
        </Link>
      </div>

      {/* タブ */}
      <div className="mb-6 flex gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <Link
            key={tab.status}
            href={`/projects?status=${tab.status}`}
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
        <p className="py-12 text-center text-gray-500">該当するプロジェクトはありません</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500">
                  更新日
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500">
                  リーダー
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500">
                  タイトル
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500">
                  カテゴリ
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500">
                  都道府県
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
                    <Link href={`/projects/${item.id}`} className="hover:underline">
                      {item.sortedAt.toLocaleDateString("ja-JP")}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <Link href={`/projects/${item.id}`} className="hover:underline">
                      {item.ownerDisplayName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <Link href={`/projects/${item.id}`} className="font-medium hover:underline">
                      {item.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {item.category ? getCategoryLabel(item.category) : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {item.prefectureCode ? getPrefectureName(item.prefectureCode) : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <ProjectPublishStatusBadge status={item.status} />
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
            {result.totalCount} 件中 {(page - 1) * PER_PAGE + 1}〜
            {Math.min(page * PER_PAGE, result.totalCount)} 件
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/projects?status=${currentStatus}&page=${page - 1}`}
                className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
              >
                前へ
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/projects?status=${currentStatus}&page=${page + 1}`}
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
