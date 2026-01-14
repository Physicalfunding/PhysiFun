"use client";

import { useState } from "react";
import { useToast } from "@/components/common/Toast";

/**
 * ParticipationFormProps - 参加申し込みフォームのプロパティ
 */
interface ParticipationFormProps {
  scheduleId: string;
  scheduleTitle: string;
  startDateTime: Date;
  capacity: number;
  currentParticipants: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

/**
 * ParticipationForm コンポーネント
 * 体験スケジュールへの参加申し込みフォーム
 *
 * 機能:
 * - 参加人数の選択（1〜残り枠まで）
 * - 申し込み送信
 * - エラー表示
 */
export function ParticipationForm({
  scheduleId,
  scheduleTitle,
  startDateTime,
  capacity,
  currentParticipants,
  onSuccess,
  onCancel,
}: ParticipationFormProps) {
  const { showToast } = useToast();
  const [participantCount, setParticipantCount] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 残り枠を計算
  const remainingCapacity = capacity - currentParticipants;
  const isFullyBooked = remainingCapacity <= 0;

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
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        const errorMessage = data.error?.message || "申し込みに失敗しました";
        setError(errorMessage);
        showToast(errorMessage, "error");
        return;
      }

      // 成功通知とコールバック
      showToast("参加申し込みを送信しました", "success");
      onSuccess?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "申し込みに失敗しました";
      setError(errorMessage);
      showToast(errorMessage, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 定員に達している場合
  if (isFullyBooked) {
    return (
      <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-center text-gray-600">この体験は定員に達しました</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white rounded-lg shadow-md">
      {/* 体験情報の表示 */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">{scheduleTitle}</h3>
        <p className="text-sm text-gray-600 mt-1">{formatDateTime(startDateTime)}</p>
        <div className="mt-2 flex items-center gap-4 text-sm">
          <span className="text-gray-600">
            残り枠: <span className="font-medium text-orange-600">{remainingCapacity}名</span>
          </span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-600">定員: {capacity}名</span>
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
        <label htmlFor="participantCount" className="block text-sm font-medium text-gray-700 mb-2">
          参加人数
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
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            disabled={isSubmitting}
          >
            キャンセル
          </button>
        )}
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isSubmitting}
        >
          {isSubmitting ? "申し込み中..." : "参加を申し込む"}
        </button>
      </div>
    </form>
  );
}
