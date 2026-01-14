import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { MessageThread } from "@/components/message/MessageThread";
import { MessageReplyForm } from "@/components/message/MessageReplyForm";

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * メッセージ詳細ページ
 *
 * 機能:
 * - メッセージスレッドの表示
 * - 返信フォームの表示
 */
export const metadata = {
  title: "メッセージ詳細 | Campfire Experience",
  description: "メッセージの詳細表示",
};

export default async function MessageDetailPage({ params }: Props) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { id: messageId } = await params;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 戻るリンク */}
      <Link
        href="/my/messages"
        className="inline-flex items-center text-gray-600 hover:text-orange-600 mb-6"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        メッセージ一覧に戻る
      </Link>

      {/* メッセージスレッド */}
      <MessageThread messageId={messageId} currentUserId={session.user.id} />

      {/* 返信フォーム */}
      <div className="mt-6">
        <MessageReplyForm
          parentMessageId={messageId}
          currentUserId={session.user.id}
        />
      </div>
    </div>
  );
}
