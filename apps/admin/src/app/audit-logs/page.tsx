import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedAdminId } from "@/lib/api/auth";
import { getAdminAuditLogQueryService } from "@/lib/di/queryServices";

/**
 * /audit-logs — AdminAuditLog 操作履歴 閲覧 UI (#149)
 *
 * - 時系列 (新しい順) で 20 件 / page 単位に表示
 * - フィルタ: 運営者 email / action / targetType / 日付範囲
 * - 書き込みは #145 / #148 で完了済み。本画面は読み取り専用
 *
 * ## 認可
 * ACTIVE な AdminAccount 以外は参照不可。
 * `getAuthenticatedAdminId` は NextAuth v4 Database 戦略経由で AdminSession 行 +
 * AdminAccount.status === ACTIVE の両方を DB で検証する契約のため、
 * null が返った時点で非 ACTIVE / 未ログインが確定する (#145 / #157)。
 */

// NOTE: 運営アプリでは Server Component から infrastructure を直接利用する規約（UseCase/Port 不要）
// ADMIN 認証必須 + 常に最新状態を表示するため force-dynamic を明示（ビルド時の静的生成を無効化）
export const dynamic = "force-dynamic";

const PER_PAGE = 20;
// page size の暴走対策。URL で ?perPage=9999 等を指定されても上限で丸める。
const PER_PAGE_MAX = 50;

/** 画面クエリのフィルタ (全て optional。空文字は undefined 扱い) */
interface AuditLogSearchParams {
  email?: string;
  action?: string;
  targetType?: string;
  /** "YYYY-MM-DD" (ローカル日付入力。UTC ではない想定) */
  from?: string;
  /** "YYYY-MM-DD" (ローカル日付入力) */
  to?: string;
  page?: string;
  perPage?: string;
}

/**
 * "YYYY-MM-DD" を Date (当日 00:00:00 JST 相当) に変換する。
 * 不正値は undefined を返す。
 */
function parseFromDate(raw: string | undefined): Date | undefined {
  if (!raw) return undefined;
  const match = /^\d{4}-\d{2}-\d{2}$/.exec(raw);
  if (!match) return undefined;
  const d = new Date(`${raw}T00:00:00+09:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * "YYYY-MM-DD" を Date (翌日 00:00:00 JST) に変換する。
 * DB 側は `lt` (未満) で比較する前提。
 * 例: to="2026-04-22" → 2026-04-23T00:00:00+09:00 を返し、当日 23:59:59.999 まで含む。
 * `lte` + 23:59:59.999 方式だと 1 ミリ秒未満の境界で取りこぼす可能性があるため、
 * 半開区間 [from, to+1day) で表現する。
 */
function parseToDate(raw: string | undefined): Date | undefined {
  if (!raw) return undefined;
  const match = /^\d{4}-\d{2}-\d{2}$/.exec(raw);
  if (!match) return undefined;
  // JST の当日 00:00:00 を起点に +1 日する (UTC の +1 日と同義)
  const base = new Date(`${raw}T00:00:00+09:00`);
  if (Number.isNaN(base.getTime())) return undefined;
  return new Date(base.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * metadata (Json) を 1 行プレビュー文字列にする。
 * - null / undefined → "-"
 * - object / array → JSON.stringify して 80 文字で切り詰め
 * - primitive → そのまま文字列化
 */
function previewMetadata(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return truncate(value, 80);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return truncate(JSON.stringify(value), 80);
  } catch {
    return "[unserializable]";
  }
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

/**
 * tooltip 用 truncate。巨大 metadata (数十 KB) をそのまま title に入れるとブラウザで
 * 重くなるため、上限文字数で切って "..." を付ける。
 * previewMetadata の `…` (U+2026) と区別するため、こちらは ASCII の "..." を使う。
 */
function truncateForTooltip(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max) + "...";
}

/**
 * 日時を "YYYY-MM-DD HH:mm:ss" (JST) で表示する。
 * toLocaleString はロケールによって区切り文字が変わるため、ここでは揃える目的で固定形式。
 * timeZone を明示しないと Node プロセスの TZ に依存してずれるため、必ず Asia/Tokyo を指定する。
 */
function formatCreatedAt(date: Date): string {
  return date.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * 現在のフィルタ条件から querystring を生成する (page 指定は別引数)。
 * 空文字・undefined は出力しない。
 */
function buildQueryString(
  filter: {
    email?: string;
    action?: string;
    targetType?: string;
    from?: string;
    to?: string;
  },
  overrides: { page?: number; perPage?: number } = {}
): string {
  const params = new URLSearchParams();
  if (filter.email) params.set("email", filter.email);
  if (filter.action) params.set("action", filter.action);
  if (filter.targetType) params.set("targetType", filter.targetType);
  if (filter.from) params.set("from", filter.from);
  if (filter.to) params.set("to", filter.to);
  if (overrides.page !== undefined) params.set("page", String(overrides.page));
  if (overrides.perPage !== undefined) params.set("perPage", String(overrides.perPage));
  const s = params.toString();
  return s ? `?${s}` : "";
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<AuditLogSearchParams>;
}) {
  // 非 ACTIVE は null になるので弾く (middleware は Cookie 有無しか見ないため最終防衛は RSC 側で)
  const adminId = await getAuthenticatedAdminId();
  if (!adminId) {
    redirect("/login");
  }

  const params = await searchParams;
  const email = params.email?.trim() || undefined;
  const action = params.action?.trim() || undefined;
  const targetType = params.targetType?.trim() || undefined;
  const from = params.from?.trim() || undefined;
  const to = params.to?.trim() || undefined;
  const fromDate = parseFromDate(from);
  const toDate = parseToDate(to);

  const page = Math.max(1, Number(params.page) || 1);
  const perPage = Math.min(
    PER_PAGE_MAX,
    Math.max(1, Number(params.perPage) || PER_PAGE)
  );

  const queryService = getAdminAuditLogQueryService();
  const [result, distinctActions, distinctTargetTypes] = await Promise.all([
    queryService.findMany(
      {
        email,
        action,
        targetType,
        from: fromDate,
        to: toDate,
      },
      { page, perPage }
    ),
    queryService.listDistinctActions(),
    queryService.listDistinctTargetTypes(),
  ]);

  const totalCount = result.totalCount;
  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
  // page が totalPages を超えていても items は空になるだけなので、
  // 表示上は件数カウントを totalCount 側でクリップして矛盾を防ぐ。
  // 0 件時は "0〜0 件" ではなく "0 件" の文言へフォールバック (下の表示ブロックでも扱う)。
  const startItem = totalCount === 0 ? 0 : Math.min((page - 1) * perPage + 1, totalCount);
  const endItem = Math.min(page * perPage, totalCount);
  const currentFilter = { email, action, targetType, from, to };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">運営操作履歴 (AdminAuditLog)</h1>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← トップに戻る
        </Link>
      </div>

      {/* フィルタ (GET form。Server Component 側で searchParams を受けて再描画) */}
      <form
        method="get"
        action="/audit-logs"
        className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6"
      >
        <label className="flex flex-col text-xs text-gray-600 sm:col-span-2">
          運営者 email
          <input
            type="email"
            name="email"
            defaultValue={email ?? ""}
            placeholder="admin@example.com"
            className="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>

        <label className="flex flex-col text-xs text-gray-600">
          Action
          <select
            name="action"
            defaultValue={action ?? ""}
            className="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">すべて</option>
            {distinctActions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-xs text-gray-600">
          TargetType
          <select
            name="targetType"
            defaultValue={targetType ?? ""}
            className="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">すべて</option>
            {distinctTargetTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-xs text-gray-600">
          期間 (from)
          <input
            type="date"
            name="from"
            defaultValue={from ?? ""}
            className="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>

        <label className="flex flex-col text-xs text-gray-600">
          期間 (to)
          <input
            type="date"
            name="to"
            defaultValue={to ?? ""}
            className="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>

        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6">
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            絞り込む
          </button>
          <Link
            href="/audit-logs"
            className="rounded border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-50"
          >
            リセット
          </Link>
          <span className="ml-auto text-sm text-gray-500">
            {totalCount} 件 (page {page} / {totalPages})
          </span>
        </div>
      </form>

      {/* テーブル */}
      {result.items.length === 0 ? (
        <p className="py-12 text-center text-gray-500">該当する履歴はありません</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-500">
                  日時 (JST)
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-500">
                  運営者
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-500">
                  action
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-500">
                  targetType
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-500">
                  targetId
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-500">
                  sessionId
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-500">
                  metadata
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {result.items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-600">
                    {formatCreatedAt(item.createdAt)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-900">
                    {item.adminEmail}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-gray-800">
                    {item.action}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-700">
                    {item.targetType}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-gray-500">
                    {item.targetId ?? "-"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-gray-400">
                    {item.adminSessionId ? `${item.adminSessionId.slice(0, 8)}…` : "-"}
                  </td>
                  <td
                    className="max-w-md truncate px-3 py-2 font-mono text-xs text-gray-600"
                    title={
                      item.metadata === null || item.metadata === undefined
                        ? ""
                        : typeof item.metadata === "string"
                          ? truncateForTooltip(item.metadata, 500)
                          : (() => {
                              try {
                                return truncateForTooltip(
                                  JSON.stringify(item.metadata, null, 2),
                                  500
                                );
                              } catch {
                                return "";
                              }
                            })()
                    }
                  >
                    {previewMetadata(item.metadata)}
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
            {totalCount === 0
              ? "0 件"
              : `${totalCount} 件中 ${startItem}〜${endItem} 件`}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/audit-logs${buildQueryString(currentFilter, { page: page - 1, perPage })}`}
                className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
              >
                前へ
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/audit-logs${buildQueryString(currentFilter, { page: page + 1, perPage })}`}
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
