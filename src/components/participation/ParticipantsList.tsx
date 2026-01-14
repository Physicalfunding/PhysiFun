"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

/**
 * 参加者情報の型定義
 */
interface Participant {
  id: string;
  participantCount: number;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  appliedAt: string;
  guest: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
}

/**
 * ParticipantsListProps - 参加者一覧コンポーネントのプロパティ
 */
interface ParticipantsListProps {
  scheduleId: string;
}

/**
 * ステータスラベル
 */
const getStatusDisplay = (status: Participant["status"]) => {
  switch (status) {
    case "PENDING":
      return { label: "申込中", className: "bg-yellow-100 text-yellow-800" };
    case "CONFIRMED":
      return { label: "確定", className: "bg-green-100 text-green-800" };
    case "CANCELLED":
      return { label: "キャンセル", className: "bg-red-100 text-red-600" };
    default:
      return { label: "不明", className: "bg-gray-100 text-gray-600" };
  }
};

/**
 * 日時フォーマット
 */
const formatDateTime = (dateStr: string): string => {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
};

/**
 * ParticipantsList コンポーネント
 * スケジュールの参加者一覧を表示するコンポーネント
 */
export function ParticipantsList({ scheduleId }: ParticipantsListProps) {
  const [data, setData] = useState<{
    schedule: {
      id: string;
      title: string;
      startDateTime: string;
      capacity: number;
    };
    project: {
      id: string;
      title: string;
    };
    participants: Participant[];
    currentParticipantCount: number;
    remainingCapacity: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchParticipants = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/schedules/${scheduleId}/participants`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || "参加者の取得に失敗しました");
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
      } finally {
        setIsLoading(false);
      }
    };

    fetchParticipants();
  }, [scheduleId]);

  // ローディング
  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent"></div>
        <p className="mt-4 text-gray-600">読み込み中...</p>
      </div>
    );
  }

  // エラー
  if (error) {
    return (
      <div className="text-center py-8 bg-red-50 rounded-lg">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* ヘッダー */}
      <div className="p-4 bg-gray-50 border-b">
        <Link
          href={`/projects/${data.project.id}`}
          className="text-sm text-gray-500 hover:text-orange-600"
        >
          {data.project.title}
        </Link>
        <h3 className="text-lg font-semibold text-gray-900 mt-1">
          {data.schedule.title}
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          {formatDateTime(data.schedule.startDateTime)}
        </p>
      </div>

      {/* 統計情報 */}
      <div className="p-4 flex gap-6 border-b bg-orange-50">
        <div>
          <span className="text-sm text-gray-600">現在の参加者</span>
          <p className="text-2xl font-bold text-orange-600">
            {data.currentParticipantCount}名
          </p>
        </div>
        <div>
          <span className="text-sm text-gray-600">定員</span>
          <p className="text-2xl font-bold text-gray-700">
            {data.schedule.capacity}名
          </p>
        </div>
        <div>
          <span className="text-sm text-gray-600">残り枠</span>
          <p className="text-2xl font-bold text-green-600">
            {data.remainingCapacity}名
          </p>
        </div>
      </div>

      {/* 参加者リスト */}
      {data.participants.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          まだ参加者はいません
        </div>
      ) : (
        <div className="divide-y">
          {data.participants.map((participant) => {
            const statusDisplay = getStatusDisplay(participant.status);
            return (
              <div key={participant.id} className="p-4 flex items-center gap-4">
                {/* アバター */}
                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                  {participant.guest.avatarUrl ? (
                    <Image
                      src={participant.guest.avatarUrl}
                      alt={participant.guest.name}
                      width={40}
                      height={40}
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      {participant.guest.name.charAt(0)}
                    </div>
                  )}
                </div>

                {/* ゲスト情報 */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {participant.guest.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    申込日: {formatDateTime(participant.appliedAt)}
                  </p>
                </div>

                {/* 参加人数 */}
                <div className="text-center">
                  <span className="text-lg font-semibold text-gray-900">
                    {participant.participantCount}名
                  </span>
                </div>

                {/* ステータス */}
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${statusDisplay.className}`}
                >
                  {statusDisplay.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
