import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ParticipationList } from "@/components/participation/ParticipationList";

/**
 * 参加予定一覧ページ（ゲストマイページ）
 *
 * 機能:
 * - ユーザーの参加申し込み一覧表示
 * - 今後の体験と過去の体験を区別表示
 * - 開催日順でソート
 */
export const metadata = {
  title: "参加予定一覧 | フィジファン",
  description: "参加予定のプロジェクト一覧",
};

export default async function MyParticipationsPage() {
  // 認証チェック
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">参加予定一覧</h1>
      <ParticipationList />
    </div>
  );
}
