import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ApplicationStatusBadge } from "@/components/ApplicationStatusBadge";
import { ReviewActions } from "@/components/ReviewActions";
import { SafeSnsLink } from "@physifun/ui-shared";
import { getAuthenticatedAdminId } from "@/lib/api/auth";
import { getCategoryLabel } from "@/lib/category";
import { getLeaderApplicationQueryService } from "@/lib/di/queryServices";
import { getPrefectureName } from "@/lib/prefecture";

// NOTE: 運営アプリでは Server Component から infrastructure を直接利用する規約（UseCase/Port 不要）
// ADMIN 認証必須 + 常に最新状態を表示するため force-dynamic を明示（ビルド時の静的生成を無効化）
export const dynamic = "force-dynamic";

/**
 * /applications/[id] — リーダー応募詳細
 *
 * ## 認可 (#147 C-1)
 * 一覧ページ (`/applications`) と同様に ACTIVE な AdminAccount のみ参照可能。
 * 動的詳細 URL 直打ちで DISABLED アカウントが閲覧できてしまう回避経路を塞ぐため、
 * RSC 側で `getAuthenticatedAdminId` により AdminSession 行 + AdminAccount.status
 * === ACTIVE を DB で再確認する。null なら /login へリダイレクト。
 */
export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const adminId = await getAuthenticatedAdminId();
  if (!adminId) {
    redirect("/login");
  }

  const { id } = await params;
  const queryService = getLeaderApplicationQueryService();
  const detail = await queryService.findById(id);

  if (!detail) {
    notFound();
  }

  const locationText = [getPrefectureName(detail.prefectureCode), detail.municipality]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* ヘッダー */}
      <div className="mb-6">
        <Link href="/applications" className="text-sm text-blue-600 hover:underline">
          ← 一覧に戻る
        </Link>
      </div>

      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{detail.projectTitle}</h1>
          <div className="mt-2 flex items-center gap-3">
            <ApplicationStatusBadge status={detail.status} />
            <span className="text-sm text-gray-500">
              応募日: {detail.submittedAt.toLocaleDateString("ja-JP")}
            </span>
            {detail.reviewedAt && (
              <span className="text-sm text-gray-500">
                審査日: {detail.reviewedAt.toLocaleDateString("ja-JP")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 応募者情報 */}
      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">応募者情報</h2>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">表示名</dt>
            <dd className="mt-1">{detail.displayName}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">メールアドレス</dt>
            <dd className="mt-1">{detail.email}</dd>
          </div>
        </dl>
      </section>

      {/* 企画内容 */}
      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">企画内容</h2>
        <dl className="space-y-6">
          <div>
            <dt className="text-sm font-medium text-gray-500">カテゴリ</dt>
            <dd className="mt-1">{getCategoryLabel(detail.projectCategory)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">活動地域</dt>
            <dd className="mt-1">{locationText}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">概要</dt>
            <dd className="mt-1 text-gray-900">{detail.projectSummary}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">詳細</dt>
            <dd className="mt-1 whitespace-pre-wrap text-gray-900">{detail.projectStory}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">活動内容</dt>
            <dd className="mt-1 whitespace-pre-wrap text-gray-900">
              {detail.activityContent ?? "（未入力）"}
            </dd>
          </div>
          {detail.snsLinks && (
            <div>
              <dt className="text-sm font-medium text-gray-500">SNS リンク</dt>
              <dd className="mt-1 space-y-1">
                <SafeSnsLink label="X" url={detail.snsLinks.x} />
                <SafeSnsLink label="Instagram" url={detail.snsLinks.instagram} />
                <SafeSnsLink label="Facebook" url={detail.snsLinks.facebook} />
                <SafeSnsLink label="Website" url={detail.snsLinks.website} />
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* 審査メモ (REJECTED のみ) */}
      {detail.status === "REJECTED" && detail.reviewerNote && (
        <section className="mb-8 rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="mb-2 text-lg font-semibold text-red-800">却下理由</h2>
          <p className="whitespace-pre-wrap text-red-900">{detail.reviewerNote}</p>
        </section>
      )}

      {/* 審査アクション (PENDING のみ) */}
      {detail.status === "PENDING" && <ReviewActions applicationId={detail.id} />}
    </div>
  );
}
