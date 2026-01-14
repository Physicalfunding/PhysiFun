"use client";

import Link from "next/link";

interface Sender {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

interface MessageCardProps {
  id: string;
  sender: Sender;
  subject: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  isCurrentUserSender: boolean;
}

/**
 * メッセージカードコンポーネント
 * メッセージ一覧で使用する個別メッセージの表示
 */
export function MessageCard({
  id,
  sender,
  subject,
  body,
  isRead,
  createdAt,
  isCurrentUserSender,
}: MessageCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString("ja-JP", {
        month: "numeric",
        day: "numeric",
        weekday: "short",
      });
    } else {
      return date.toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
      });
    }
  };

  const truncateBody = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  return (
    <Link
      href={`/my/messages/${id}`}
      className={`block border-b border-gray-200 p-4 hover:bg-gray-50 transition-colors ${
        !isRead && !isCurrentUserSender ? "bg-orange-50" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {/* アバター */}
        <div className="flex-shrink-0">
          {sender.avatarUrl ? (
            <img
              src={sender.avatarUrl}
              alt={sender.name || "ユーザー"}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
              <span className="text-gray-600 text-sm">
                {sender.name?.charAt(0) || "?"}
              </span>
            </div>
          )}
        </div>

        {/* メッセージ内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <span className={`text-sm ${!isRead && !isCurrentUserSender ? "font-bold" : ""}`}>
                {isCurrentUserSender ? "To: " : "From: "}
                {sender.name || "名前未設定"}
              </span>
              {!isRead && !isCurrentUserSender && (
                <span className="px-2 py-0.5 bg-orange-500 text-white text-xs rounded-full">
                  未読
                </span>
              )}
            </div>
            <span className="text-xs text-gray-500 flex-shrink-0">
              {formatDate(createdAt)}
            </span>
          </div>

          <h3 className={`text-sm ${!isRead && !isCurrentUserSender ? "font-bold text-gray-900" : "text-gray-800"} mb-1 truncate`}>
            {subject}
          </h3>

          <p className="text-xs text-gray-500 truncate">
            {truncateBody(body)}
          </p>
        </div>
      </div>
    </Link>
  );
}
