"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ProjectStatusToggleProps {
  projectId: string;
  status: string;
}

/**
 * ProjectStatusToggle コンポーネント
 * プロジェクトの公開/非公開状態を切り替えるUI
 */
export function ProjectStatusToggle({ projectId, status }: ProjectStatusToggleProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPublished = status === "PUBLISHED";

  /**
   * 公開/非公開の切り替え処理
   */
  const handleToggle = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const endpoint = isPublished
        ? `/api/projects/${projectId}/unpublish`
        : `/api/projects/${projectId}/publish`;

      const response = await fetch(endpoint, {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error?.message || "ステータスの変更に失敗しました");
        return;
      }

      router.refresh();
    } catch (error) {
      setError("通信エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* 現在のステータス表示 */}
      <div className="flex items-center space-x-2">
        <span className="text-sm text-gray-600">ステータス:</span>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isPublished
              ? "bg-green-100 text-green-800"
              : "bg-yellow-100 text-yellow-800"
          }`}
        >
          {isPublished ? "公開中" : "下書き"}
        </span>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* 切り替えボタン */}
      <button
        onClick={handleToggle}
        disabled={isLoading}
        className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
          isPublished
            ? "bg-yellow-500 text-white hover:bg-yellow-600 disabled:bg-yellow-300"
            : "bg-green-500 text-white hover:bg-green-600 disabled:bg-green-300"
        }`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center">
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            処理中...
          </span>
        ) : isPublished ? (
          "非公開にする"
        ) : (
          "公開する"
        )}
      </button>

      {/* 説明テキスト */}
      <p className="text-xs text-gray-500">
        {isPublished
          ? "非公開にすると、ゲストにプロジェクトが表示されなくなります。"
          : "公開すると、ゲストにプロジェクトが表示されるようになります。"}
      </p>
    </div>
  );
}
