"use client";

import { useState, useEffect } from "react";
import { MessageCard } from "./MessageCard";

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
  sender: User;
  receiver: User;
}

interface MessageListProps {
  currentUserId: string;
}

type TabType = "received" | "sent";

/**
 * メッセージ一覧コンポーネント
 * 受信・送信メッセージのタブ切り替え表示
 */
export function MessageList({ currentUserId }: MessageListProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("received");

  useEffect(() => {
    fetchMessages();
  }, [activeTab]);

  const fetchMessages = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/messages?type=${activeTab}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "メッセージの取得に失敗しました");
      }

      setMessages(data.data.messages);
      setUnreadCount(data.data.unreadCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* タブ */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          <button
            onClick={() => setActiveTab("received")}
            className={`flex-1 py-4 px-6 text-center border-b-2 font-medium text-sm ${
              activeTab === "received"
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            受信メッセージ
            {unreadCount > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-orange-500 text-white text-xs rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("sent")}
            className={`flex-1 py-4 px-6 text-center border-b-2 font-medium text-sm ${
              activeTab === "sent"
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            送信済み
          </button>
        </nav>
      </div>

      {/* メッセージ一覧 */}
      {isLoading ? (
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-500">読み込み中...</p>
        </div>
      ) : messages.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <svg
            className="w-12 h-12 mx-auto mb-4 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <p>
            {activeTab === "received"
              ? "受信メッセージはありません"
              : "送信済みメッセージはありません"}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200">
          {messages.map((message) => (
            <MessageCard
              key={message.id}
              id={message.id}
              sender={activeTab === "received" ? message.sender : message.receiver}
              subject={message.subject}
              body={message.body}
              isRead={message.isRead}
              createdAt={message.createdAt}
              isCurrentUserSender={message.senderId === currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
