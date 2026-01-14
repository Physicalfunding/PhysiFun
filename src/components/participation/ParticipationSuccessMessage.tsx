"use client";

import Link from "next/link";

/**
 * ParticipationSuccessMessageProps - 参加完了メッセージのプロパティ
 */
interface ParticipationSuccessMessageProps {
  scheduleTitle: string;
  projectTitle: string;
  onClose?: () => void;
}

/**
 * ParticipationSuccessMessage コンポーネント
 * 参加申し込み完了後に表示するメッセージ
 */
export function ParticipationSuccessMessage({
  scheduleTitle,
  projectTitle,
  onClose,
}: ParticipationSuccessMessageProps) {
  return (
    <div className="p-6 bg-green-50 border border-green-200 rounded-lg text-center">
      {/* 成功アイコン */}
      <div className="mx-auto w-16 h-16 flex items-center justify-center bg-green-100 rounded-full mb-4">
        <svg
          className="w-8 h-8 text-green-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>

      {/* メッセージ */}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        参加申し込みが完了しました
      </h3>
      <p className="text-sm text-gray-600 mb-1">
        <span className="font-medium">{projectTitle}</span>
      </p>
      <p className="text-sm text-gray-600 mb-4">
        「{scheduleTitle}」への参加申し込みを受け付けました
      </p>

      {/* リンク */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/my/participations"
          className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors"
        >
          参加予定一覧を見る
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            閉じる
          </button>
        )}
      </div>
    </div>
  );
}
