import Link from "next/link";
// NOTE: 運営アプリでは Server Component から infrastructure を直接利用する規約（UseCase/Port 不要）
import {
  PrismaOutboxQueryService,
  deriveOutboxStatus,
  isValidOutboxStatus,
  type OutboxSource,
  type OutboxStatus,
} from "@physifun/infrastructure";
import { OutboxStatusBadge } from "@/components/OutboxStatusBadge";
import { OutboxActions } from "@/components/OutboxActions";

export const dynamic = "force-dynamic";

const queryService = new PrismaOutboxQueryService();

const SOURCE_TABS: { source: OutboxSource; label: string }[] = [
  { source: "leaderApplication", label: "リーダー応募" },
  { source: "project", label: "プロジェクト" },
];

const STATUS_FILTERS: { status: OutboxStatus | "incomplete"; label: string }[] = [
  { status: "incomplete", label: "未完了" },
  { status: "pending", label: "未送信" },
  { status: "retrying", label: "リトライ中" },
  { status: "dead-lettered", label: "デッドレター" },
  { status: "sent", label: "送信済み" },
];

/**
 * /outbox - Outbox 監視一覧
 */
export default async function OutboxListPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const currentSource: OutboxSource = params.source === "project" ? "project" : "leaderApplication";
  // ステータスバリデーション: 無効な値は "incomplete" にフォールバック
  const rawStatus = params.status ?? "incomplete";
  const currentStatusFilter =
    rawStatus === "incomplete" || isValidOutboxStatus(rawStatus) ? rawStatus : "incomplete";
  const page = Math.max(1, Number(params.page) || 1);
  const perPage = 20;

  // ステータスを Prisma クエリ用に変換
  // "incomplete" = デフォルト（sentAt IS NULL）、それ以外はそのまま
  const queryStatus: OutboxStatus | undefined =
    currentStatusFilter === "incomplete" ? undefined : currentStatusFilter;

  // データ取得 + 各ステータスのカウント（並列）
  const [result, pendingCount, retryingCount, deadLetteredCount, sentCount] = await Promise.all([
    queryService.findMany(currentSource, { status: queryStatus, page, perPage }),
    queryService.countByStatus(currentSource, "pending"),
    queryService.countByStatus(currentSource, "retrying"),
    queryService.countByStatus(currentSource, "dead-lettered"),
    queryService.countByStatus(currentSource, "sent"),
  ]);

  const totalPages = Math.ceil(result.totalCount / perPage);
  const incompleteCount = pendingCount + retryingCount + deadLetteredCount;

  const countMap: Record<string, number> = {
    incomplete: incompleteCount,
    pending: pendingCount,
    retrying: retryingCount,
    "dead-lettered": deadLetteredCount,
    sent: sentCount,
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Outbox 監視</h1>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          &larr; トップに戻る
        </Link>
      </div>

      {/* ソースタブ */}
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {SOURCE_TABS.map((tab) => (
          <Link
            key={tab.source}
            href={`/outbox?source=${tab.source}`}
            className={`px-4 py-2 text-sm font-medium ${
              currentSource === tab.source
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* ステータスフィルタ */}
      <div className="mb-6 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <Link
            key={filter.status}
            href={`/outbox?source=${currentSource}&status=${filter.status}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              currentStatusFilter === filter.status
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {filter.label}
            <span className="ml-1">({countMap[filter.status]})</span>
          </Link>
        ))}
      </div>

      {/* テーブル */}
      {result.items.length === 0 ? (
        <p className="py-12 text-center text-gray-500">該当するメッセージはありません</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500">
                  作成日時
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500">
                  タイプ
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500">
                  ステータス
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500">
                  試行回数
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500">
                  最終エラー
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500">
                  次回リトライ
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500">
                  アクション
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {result.items.map((item) => {
                const status = deriveOutboxStatus(item);
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {item.createdAt.toLocaleString("ja-JP", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-gray-900">{item.type}</td>
                    <td className="px-4 py-3">
                      <OutboxStatusBadge status={status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.attempts}</td>
                    <td className="max-w-xs px-4 py-3 text-sm text-gray-600">
                      {item.lastError ? (
                        <span className="block truncate" title={item.lastError}>
                          {item.lastError}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {item.nextRetryAt ? (
                        item.nextRetryAt.toLocaleString("ja-JP", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <OutboxActions id={item.id} source={currentSource} status={status} />
                    </td>
                  </tr>
                );
              })}
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
                href={`/outbox?source=${currentSource}&status=${currentStatusFilter}&page=${page - 1}`}
                className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
              >
                前へ
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/outbox?source=${currentSource}&status=${currentStatusFilter}&page=${page + 1}`}
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
