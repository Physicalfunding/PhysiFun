"use client";

import { useState, useEffect } from "react";
import { ParticipationCard, ParticipationCardProps } from "./ParticipationCard";

/**
 * ParticipationList コンポーネント
 * 参加予定一覧を表示するクライアントコンポーネント
 *
 * 機能:
 * - 参加予定データの取得
 * - 今後の体験と過去の体験の表示切り替え
 * - ローディング・エラー・空状態の表示
 */
export function ParticipationList() {
  const [participations, setParticipations] = useState<ParticipationCardProps[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  // データ取得
  useEffect(() => {
    const fetchParticipations = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/my/participations");

        if (!response.ok) {
          throw new Error("参加予定の取得に失敗しました");
        }

        const data = await response.json();
        setParticipations(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
      } finally {
        setIsLoading(false);
      }
    };

    fetchParticipations();
  }, []);

  // 今後の体験と過去の体験を分類
  const upcomingParticipations = participations.filter((p) => !p.isPast);
  const pastParticipations = participations.filter((p) => p.isPast);

  // ローディング中
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent"></div>
        <p className="mt-4 text-gray-600">読み込み中...</p>
      </div>
    );
  }

  // エラー時
  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600"
        >
          再読み込み
        </button>
      </div>
    );
  }

  // 参加予定がない場合
  if (participations.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <svg
          className="mx-auto w-16 h-16 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p className="mt-4 text-gray-600">まだ参加予定の体験はありません</p>
        <a
          href="/projects"
          className="mt-4 inline-block px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600"
        >
          プロジェクトを探す
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 今後の体験 */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
          今後の体験
          {upcomingParticipations.length > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              （{upcomingParticipations.length}件）
            </span>
          )}
        </h2>
        {upcomingParticipations.length > 0 ? (
          <div className="space-y-4">
            {upcomingParticipations.map((participation) => (
              <ParticipationCard key={participation.id} {...participation} />
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm py-4">今後の参加予定はありません</p>
        )}
      </section>

      {/* 過去の体験（トグル表示） */}
      {pastParticipations.length > 0 && (
        <section>
          <button
            onClick={() => setShowPast(!showPast)}
            className="flex items-center text-lg font-semibold text-gray-700 hover:text-gray-900"
          >
            <svg
              className={`w-4 h-4 mr-2 transition-transform ${showPast ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            過去の体験
            <span className="ml-2 text-sm font-normal text-gray-500">
              （{pastParticipations.length}件）
            </span>
          </button>

          {showPast && (
            <div className="mt-4 space-y-4">
              {pastParticipations.map((participation) => (
                <ParticipationCard key={participation.id} {...participation} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
