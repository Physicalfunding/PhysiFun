import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { ParticipantsList } from "@/components/participation/ParticipantsList";

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * 参加者管理ページ（ホスト向け）
 *
 * 機能:
 * - スケジュールの参加者一覧表示
 * - 参加人数と定員の表示
 * - 参加者情報（名前、申込日時、参加人数）の表示
 */
export const metadata = {
  title: "参加者管理 | Campfire Experience",
  description: "体験スケジュールの参加者を管理",
};

export default async function ParticipantsPage({ params }: Props) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { id: scheduleId } = await params;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 戻るリンク */}
      <Link
        href="/my/project"
        className="inline-flex items-center text-gray-600 hover:text-orange-600 mb-6"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        マイプロジェクトに戻る
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">参加者管理</h1>

      <ParticipantsList scheduleId={scheduleId} />
    </div>
  );
}
