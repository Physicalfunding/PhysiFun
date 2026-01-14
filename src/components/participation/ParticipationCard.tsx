"use client";

import Image from "next/image";
import Link from "next/link";

/**
 * ParticipationCardProps - 参加予定カードのプロパティ
 */
export interface ParticipationCardProps {
  id: string;
  participantCount: number;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  appliedAt: string;
  isPast: boolean;
  schedule: {
    id: string;
    title: string;
    description: string;
    startDateTime: string;
    duration: number | null;
    requirements: string | null;
  };
  project: {
    id: string;
    title: string;
    location: string;
    imageUrl: string | null;
    host: {
      id: string;
      name: string;
      avatarUrl: string | null;
    };
  };
}

/**
 * ステータスに応じたラベル・色を返すヘルパー関数
 */
const getStatusDisplay = (status: ParticipationCardProps["status"], isPast: boolean) => {
  if (isPast) {
    return { label: "終了", className: "bg-gray-100 text-gray-600" };
  }
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
 * 日時を日本語フォーマットで表示
 */
const formatDateTime = (dateStr: string): string => {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  }).format(new Date(dateStr));
};

/**
 * ParticipationCard コンポーネント
 * ゲストマイページに表示する参加予定カード
 *
 * 表示項目:
 * - プロジェクト画像
 * - プロジェクトタイトル
 * - 体験タイトル
 * - 開催日時
 * - 開催場所
 * - ステータス
 * - 参加人数
 */
export function ParticipationCard({
  id,
  participantCount,
  status,
  appliedAt,
  isPast,
  schedule,
  project,
}: ParticipationCardProps) {
  const statusDisplay = getStatusDisplay(status, isPast);

  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden ${isPast ? "opacity-70" : ""}`}>
      <div className="flex flex-col sm:flex-row">
        {/* 画像 */}
        <div className="relative w-full sm:w-48 h-32 sm:h-auto bg-gray-200 flex-shrink-0">
          {project.imageUrl ? (
            <Image
              src={project.imageUrl}
              alt={project.title}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 192px"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <svg
                className="w-12 h-12 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}
        </div>

        {/* 情報 */}
        <div className="flex-1 p-4">
          {/* ステータス・参加人数 */}
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${statusDisplay.className}`}
            >
              {statusDisplay.label}
            </span>
            <span className="text-sm text-gray-600">
              参加人数: {participantCount}名
            </span>
          </div>

          {/* プロジェクトタイトル */}
          <Link
            href={`/projects/${project.id}`}
            className="text-sm text-gray-500 hover:text-orange-600"
          >
            {project.title}
          </Link>

          {/* 体験タイトル */}
          <h3 className="text-lg font-semibold text-gray-900 mt-1">
            {schedule.title}
          </h3>

          {/* 開催日時 */}
          <div className="flex items-center text-sm text-gray-600 mt-2">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>{formatDateTime(schedule.startDateTime)}</span>
            {schedule.duration && (
              <span className="ml-2 text-gray-400">（{schedule.duration}分）</span>
            )}
          </div>

          {/* 開催場所 */}
          <div className="flex items-center text-sm text-gray-600 mt-1">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span>{project.location}</span>
          </div>

          {/* ホスト情報 */}
          <div className="flex items-center mt-3">
            <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden mr-2">
              {project.host.avatarUrl ? (
                <Image
                  src={project.host.avatarUrl}
                  alt={project.host.name}
                  width={24}
                  height={24}
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                  {project.host.name.charAt(0)}
                </div>
              )}
            </div>
            <span className="text-sm text-gray-600">{project.host.name}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
