import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { MessageList } from "@/components/message/MessageList";

/**
 * メッセージ一覧ページ
 *
 * 機能:
 * - 受信メッセージ一覧表示
 * - 送信済みメッセージ一覧表示
 * - 未読件数の表示
 */
export const metadata = {
  title: "メッセージ | Campfire Experience",
  description: "メッセージの送受信管理",
};

export default async function MessagesPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">メッセージ</h1>
      </div>

      {/* メッセージ一覧 */}
      <MessageList currentUserId={session.user.id} />

      {/* 戻るリンク */}
      <div className="mt-6">
        <Link href="/my" className="inline-flex items-center text-gray-600 hover:text-orange-600">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          マイページに戻る
        </Link>
      </div>
    </div>
  );
}
