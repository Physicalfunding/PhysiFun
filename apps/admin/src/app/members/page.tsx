import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedAdminId } from "@/lib/api/auth";
import { getAdminAccountRepository } from "@/lib/di/queryServices";
import { MemberRowActions } from "@/components/MemberRowActions";
import { AddMemberForm } from "@/components/AddMemberForm";

// 常に最新状態を表示するため force-dynamic (静的生成を無効化)
export const dynamic = "force-dynamic";

// #167: ページサイズのデフォルトと上限。audit-logs の PER_PAGE / PER_PAGE_MAX と揃える。
const PER_PAGE = 20;
const PER_PAGE_MAX = 50;

interface MembersSearchParams {
  page?: string;
  perPage?: string;
}

/**
 * 現在のページ情報から querystring を生成する (page 指定は別引数)。
 */
function buildQueryString(overrides: { page?: number; perPage?: number }): string {
  const params = new URLSearchParams();
  if (overrides.page !== undefined) params.set("page", String(overrides.page));
  if (overrides.perPage !== undefined) params.set("perPage", String(overrides.perPage));
  const s = params.toString();
  return s ? `?${s}` : "";
}

/**
 * /members — 運営メンバー管理 (#148 / #167 ページネーション対応)
 *
 * - ACTIVE な AdminAccount のみが到達可能 (middleware + getAuthenticatedAdminId)
 * - 自分自身に対しては「無効化」ボタンを表示しない (Route Handler 側でも集約ガードあり)
 * - `page` / `perPage` クエリでページング (audit-logs と同じパターン)
 */
export default async function MembersListPage({
  searchParams,
}: {
  searchParams: Promise<MembersSearchParams>;
}) {
  const operatorId = await getAuthenticatedAdminId();
  if (!operatorId) {
    // middleware が弾く想定だが、防御的に。
    redirect("/login");
  }

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const perPage = Math.min(
    PER_PAGE_MAX,
    Math.max(1, Number(params.perPage) || PER_PAGE)
  );

  const repo = getAdminAccountRepository();
  const { items: members, totalCount } = await repo.findAll({ page, perPage });

  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
  const startItem = totalCount === 0 ? 0 : Math.min((page - 1) * perPage + 1, totalCount);
  const endItem = Math.min(page * perPage, totalCount);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">運営メンバー管理</h1>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← トップに戻る
        </Link>
      </div>

      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-3 text-lg font-semibold">新規メンバー追加</h2>
        <p className="mb-4 text-sm text-gray-600">
          メールアドレスを登録すると ACTIVE
          状態で運営メンバーが追加されます。登録後、対象者がマジックリンクでログインできるようになります。
        </p>
        <AddMemberForm />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">メンバー一覧</h2>
          <span className="text-sm text-gray-500">
            {totalCount} 件 (page {page} / {totalPages})
          </span>
        </div>
        {members.length === 0 ? (
          <p className="py-12 text-center text-gray-500">メンバーがいません</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500">
                    メールアドレス
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500">
                    状態
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500">
                    作成日時
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500">
                    最終ログイン
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium tracking-wider text-gray-500">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {members.map((m) => {
                  const id = m.id.toString();
                  const email = m.email.toString();
                  const isSelf = id === operatorId;
                  const isActive = m.isActive();
                  return (
                    <tr key={id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {email}
                        {isSelf && (
                          <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                            あなた
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {isActive ? "ACTIVE" : "DISABLED"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {m.createdAt.toLocaleString("ja-JP")}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {m.lastLoginAt ? m.lastLoginAt.toLocaleString("ja-JP") : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <MemberRowActions
                          memberId={id}
                          memberEmail={email}
                          isActive={isActive}
                          isSelf={isSelf}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ページネーション (audit-logs と同じ UI パターン) */}
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
                  href={`/members${buildQueryString({ page: page - 1, perPage })}`}
                  className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
                >
                  前へ
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/members${buildQueryString({ page: page + 1, perPage })}`}
                  className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
                >
                  次へ
                </Link>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
