"use client";

import { useState } from "react";

/**
 * ParticipationConfirmDialogProps - 参加確認ダイアログのプロパティ
 */
interface ParticipationConfirmDialogProps {
  isOpen: boolean;
  scheduleId: string;
  scheduleTitle: string;
  projectTitle: string;
  startDateTime: Date;
  location: string;
  capacity: number;
  currentParticipants: number;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * ParticipationConfirmDialog コンポーネント
 * 参加申し込みの確認モーダルダイアログ
 *
 * 機能:
 * - 申し込み内容の確認表示
 * - 参加人数の選択
 * - 申し込み確定とキャンセル
 */
export function ParticipationConfirmDialog({
  isOpen,
  scheduleId,
  scheduleTitle,
  projectTitle,
  startDateTime,
  location,
  capacity,
  currentParticipants,
  onClose,
  onSuccess,
}: ParticipationConfirmDialogProps) {
  const [participantCount, setParticipantCount] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 残り枠を計算
  const remainingCapacity = capacity - currentParticipants;

  /**
   * 日時を日本語フォーマットで表示
   */
  const formatDateTime = (date: Date): string => {
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    }).format(new Date(date));
  };

  /**
   * 参加申し込みを送信
   */
  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/schedules/${scheduleId}/participate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ participantCount }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "申し込みに失敗しました");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "申し込みに失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    // オーバーレイ
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      {/* ダイアログ本体 */}
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl overflow-hidden">
        {/* ヘッダー */}
        <div className="px-6 py-4 bg-orange-500">
          <h2 className="text-xl font-bold text-white">参加申し込み確認</h2>
        </div>

        {/* コンテンツ */}
        <div className="p-6">
          {/* プロジェクト・体験情報 */}
          <div className="mb-6 space-y-3">
            <div>
              <p className="text-xs text-gray-500">プロジェクト</p>
              <p className="font-medium text-gray-900">{projectTitle}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">体験タイトル</p>
              <p className="font-medium text-gray-900">{scheduleTitle}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">開催日時</p>
              <p className="font-medium text-gray-900">{formatDateTime(startDateTime)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">開催場所</p>
              <p className="font-medium text-gray-900">{location}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">残り枠</p>
              <p className="font-medium text-orange-600">{remainingCapacity}名 / 定員{capacity}名</p>
            </div>
          </div>

          {/* エラー表示 */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* 参加人数選択 */}
          <div className="mb-6">
            <label
              htmlFor="participantCount"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              参加人数を選択してください
            </label>
            <select
              id="participantCount"
              value={participantCount}
              onChange={(e) => setParticipantCount(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              disabled={isSubmitting}
            >
              {Array.from({ length: remainingCapacity }, (_, i) => i + 1).map((num) => (
                <option key={num} value={num}>
                  {num}名
                </option>
              ))}
            </select>
          </div>

          {/* ボタン */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={isSubmitting}
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting || remainingCapacity <= 0}
            >
              {isSubmitting ? "申し込み中..." : "申し込みを確定する"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
