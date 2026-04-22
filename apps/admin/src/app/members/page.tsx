import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedAdminId } from "@/lib/api/auth";
import { getAdminAccountRepository } from "@/lib/di/queryServices";
import { MemberRowActions } from "@/components/MemberRowActions";
import { AddMemberForm } from "@/components/AddMemberForm";

// 常に最新状態を表示するため force-dynamic (静的生成を無効化)
export const dynamic = "force-dynamic";

/**
 * /members — 運営メンバー管理 (#148)
 *
 * - ACTIVE な AdminAccount のみが到達可能 (middleware + getAuthenticatedAdminId)
 * - 自分自身に対しては「無効化」ボタンを表示しない (Route Handler 側でも集約ガードあり)
 */
export default async function MembersListPage() {
  const operatorId = await getAuthenticatedAdminId();
  if (!operatorId) {
    // middleware が弾く想定だが、防御的に。
    redirect("/login");
  }

  const repo = getAdminAccountRepository();
  const members = await repo.findAll();

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
        <h2 className="mb-3 text-lg font-semibold">メンバー一覧</h2>
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
      </section>
    </div>
  );
}
