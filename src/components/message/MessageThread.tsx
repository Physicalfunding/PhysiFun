"use client";

import { useState, useEffect } from "react";

interface User {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  subject: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
  parentMessageId: string | null;
  sender: User;
  receiver: User;
}

interface MessageThreadProps {
  messageId: string;
  currentUserId: string;
}

/**
 * メッセージスレッドコンポーネント
 * メッセージの詳細とスレッド（返信）を表示
 */
export function MessageThread({ messageId, currentUserId }: MessageThreadProps) {
  const [thread, setThread] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchThread();
  }, [messageId]);

  const fetchThread = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/messages/${messageId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "メッセージの取得に失敗しました");
      }

      setThread(data.data.thread);

      // 未読メッセージを既読にする
      const unreadMessages = data.data.thread.filter(
        (m: Message) => !m.isRead && m.receiverId === currentUserId
      );
      for (const msg of unreadMessages) {
        await fetch(`/api/messages/${msg.id}`, { method: "PATCH" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("ja-JP", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
        <p className="mt-2 text-sm text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error}
      </div>
    );
  }

  if (thread.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        メッセージが見つかりません
      </div>
    );
  }

  const firstMessage = thread[0];

  return (
    <div className="bg-white rounded-lg shadow">
      {/* 件名 */}
      <div className="border-b border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {firstMessage.subject}
        </h2>
      </div>

      {/* メッセージスレッド */}
      <div className="divide-y divide-gray-100">
        {thread.map((message, index) => {
          const isCurrentUserSender = message.senderId === currentUserId;

          return (
            <div
              key={message.id}
              className={`p-4 ${index === 0 ? "" : "bg-gray-50"}`}
            >
              <div className="flex items-start gap-3">
                {/* アバター */}
                <div className="flex-shrink-0">
                  {message.sender.avatarUrl ? (
                    <img
                      src={message.sender.avatarUrl}
                      alt={message.sender.name || "ユーザー"}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                      <span className="text-gray-600 text-sm">
                        {message.sender.name?.charAt(0) || "?"}
                      </span>
                    </div>
                  )}
                </div>

                {/* メッセージ内容 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {message.sender.name || "名前未設定"}
                      </span>
                      {isCurrentUserSender && (
                        <span className="text-xs text-gray-500">(自分)</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatDateTime(message.createdAt)}
                    </span>
                  </div>

                  <div className="text-gray-700 whitespace-pre-wrap">
                    {message.body}
                  </div>

                  {/* 既読表示 */}
                  {isCurrentUserSender && message.readAt && (
                    <div className="mt-2 text-xs text-gray-400">
                      既読: {formatDateTime(message.readAt)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
