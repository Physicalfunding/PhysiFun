"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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
  sender: User;
  receiver: User;
}

interface MessageReplyFormProps {
  parentMessageId: string;
  currentUserId: string;
}

/**
 * メッセージ返信フォームコンポーネント
 */
export function MessageReplyForm({ parentMessageId, currentUserId }: MessageReplyFormProps) {
  const router = useRouter();
  const [parentMessage, setParentMessage] = useState<Message | null>(null);
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchParentMessage();
  }, [parentMessageId]);

  const fetchParentMessage = async () => {
    try {
      const response = await fetch(`/api/messages/${parentMessageId}`);
      const data = await response.json();

      if (response.ok) {
        setParentMessage(data.data.message);
      }
    } catch (err) {
      console.error("Failed to fetch parent message:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!parentMessage) {
      setError("返信先のメッセージが見つかりません");
      setIsSubmitting(false);
      return;
    }

    // 返信先を決定（自分が送信者なら相手へ、自分が受信者なら送信者へ）
    const receiverId =
      parentMessage.senderId === currentUserId
        ? parentMessage.receiverId
        : parentMessage.senderId;

    try {
      const response = await fetch("/api/messages/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentMessageId,
          receiverId,
          body: body.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "返信の送信に失敗しました");
      }

      // フォームをクリアしてリロード
      setBody("");
      router.refresh();
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-24 bg-gray-200 rounded mb-4"></div>
        </div>
      </div>
    );
  }

  if (!parentMessage) {
    return null;
  }

  const replyTo =
    parentMessage.senderId === currentUserId
      ? parentMessage.receiver
      : parentMessage.sender;

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">返信を送信</h3>

      <form onSubmit={handleSubmit}>
        {/* 返信先表示 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            返信先
          </label>
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
            {replyTo.avatarUrl ? (
              <img
                src={replyTo.avatarUrl}
                alt={replyTo.name || "ユーザー"}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                <span className="text-gray-600 text-xs">
                  {replyTo.name?.charAt(0) || "?"}
                </span>
              </div>
            )}
            <span className="text-sm text-gray-700">
              {replyTo.name || "名前未設定"}
            </span>
          </div>
        </div>

        {/* 本文入力 */}
        <div className="mb-4">
          <label
            htmlFor="reply-body"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            メッセージ
          </label>
          <textarea
            id="reply-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
            placeholder="返信内容を入力..."
            required
          />
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* 送信ボタン */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || !body.trim()}
            className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "送信中..." : "返信を送信"}
          </button>
        </div>
      </form>
    </div>
  );
}
