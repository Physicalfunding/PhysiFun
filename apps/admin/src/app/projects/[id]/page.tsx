import Link from "next/link";
import { notFound } from "next/navigation";
// NOTE: 運営アプリでは Server Component から infrastructure を直接利用する規約（UseCase/Port 不要）
import { PrismaProjectQueryService } from "@physifun/infrastructure";
import type { ReviewAction } from "@physifun/domain";
import { ProjectPublishStatusBadge } from "@/components/ProjectPublishStatusBadge";
import { ProjectPhaseBadge } from "@/components/ProjectPhaseBadge";
import { ProjectReviewActions } from "@/components/ProjectReviewActions";
import { SafeSnsLink, isSafeHttpsUrl } from "@physifun/ui-shared";
import { getCategoryLabel } from "@/lib/category";
import { getPrefectureName } from "@/lib/prefecture";

// ADMIN 認証が必要な動的ページのため、ビルド時の静的生成を無効化する
export const dynamic = "force-dynamic";

const queryService = new PrismaProjectQueryService();

const REVIEW_ACTION_LABELS: Record<ReviewAction, string> = {
  APPROVED: "承認",
  REJECTED: "差戻",
  FORCE_UNPUBLISHED: "強制非公開",
};

const REVIEW_ACTION_STYLES: Record<ReviewAction, string> = {
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  FORCE_UNPUBLISHED: "bg-red-100 text-red-800",
};

function formatDateTime(date: Date | null): string {
  if (!date) return "-";
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * /projects/[id] — プロジェクト審査詳細
 */
export default async function AdminProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await queryService.findDetailForAdmin(id);

  if (!detail) {
    notFound();
  }

  const locationText = [
    detail.prefectureCode ? getPrefectureName(detail.prefectureCode) : null,
    detail.municipality,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* ヘッダー */}
      <div className="mb-6">
        <Link href="/projects" className="text-sm text-blue-600 hover:underline">
          ← 一覧に戻る
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold">{detail.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <ProjectPublishStatusBadge status={detail.status} />
          <ProjectPhaseBadge phase={detail.phase} />
        </div>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-gray-500 sm:grid-cols-3">
          <div>
            <dt className="inline font-medium">更新日時: </dt>
            <dd className="inline">{formatDateTime(detail.updatedAt)}</dd>
          </div>
          <div>
            <dt className="inline font-medium">公開申請日時: </dt>
            <dd className="inline">{formatDateTime(detail.publishRequestedAt)}</dd>
          </div>
          <div>
            <dt className="inline font-medium">公開日時: </dt>
            <dd className="inline">{formatDateTime(detail.publishedAt)}</dd>
          </div>
        </dl>
      </div>

      {/* プロジェクト情報 */}
      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">プロジェクト情報</h2>
        <dl className="space-y-6">
          <div>
            <dt className="text-sm font-medium text-gray-500">カテゴリ</dt>
            <dd className="mt-1">{detail.category ? getCategoryLabel(detail.category) : "-"}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">活動地域</dt>
            <dd className="mt-1">{locationText || "-"}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">概要</dt>
            <dd className="mt-1 whitespace-pre-wrap text-gray-900">{detail.summary ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">本文</dt>
            <dd className="mt-1 whitespace-pre-wrap text-gray-900">{detail.body ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">リーダー紹介</dt>
            <dd className="mt-1 whitespace-pre-wrap text-gray-900">
              {detail.leaderIntroduction ?? "-"}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">活動計画</dt>
            <dd className="mt-1 whitespace-pre-wrap text-gray-900">{detail.activityPlan ?? "-"}</dd>
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
          {detail.coverImageUrl && (
            <div>
              <dt className="text-sm font-medium text-gray-500">カバー画像</dt>
              <dd className="mt-1">
                {isSafeHttpsUrl(detail.coverImageUrl) ? (
                  <>
                    {/* next/image を使わず素の img で表示 (外部ホスト許可リスト設定を避けるため) */}
                    {/* Issue #120 で Supabase Storage ドメイン allowlist + next/image 移行予定 */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={detail.coverImageUrl}
                      alt="カバー画像"
                      className="max-h-80 w-auto rounded-md border border-gray-200"
                    />
                  </>
                ) : (
                  // 生の URL を画面に出力すると javascript:/data: など悪意のある URL や
                  // 機密を含む URL がそのまま管理画面に露出するため、固定文言のみ表示する
                  // (PR #142 Major-1 対応)
                  <p className="text-sm text-red-600">表示できない URL 形式です</p>
                )}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* リーダー情報 */}
      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">リーダー情報</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">表示名</dt>
            <dd className="mt-1">{detail.owner.displayName}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">メールアドレス</dt>
            <dd className="mt-1">{detail.owner.email}</dd>
          </div>
          {detail.owner.bio && (
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-gray-500">自己紹介</dt>
              <dd className="mt-1 whitespace-pre-wrap text-gray-900">{detail.owner.bio}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* 審査履歴 */}
      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">審査履歴</h2>
        {detail.reviewFeedbacks.length === 0 ? (
          <p className="text-sm text-gray-500">審査履歴はまだありません</p>
        ) : (
          <ul className="space-y-4">
            {detail.reviewFeedbacks.map((feedback) => (
              <li key={feedback.id} className="rounded-md border border-gray-200 bg-gray-50 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${REVIEW_ACTION_STYLES[feedback.action]}`}
                  >
                    {REVIEW_ACTION_LABELS[feedback.action]}
                  </span>
                  <span className="text-sm text-gray-700">{feedback.reviewerDisplayName}</span>
                  <span className="text-xs text-gray-500">
                    {formatDateTime(feedback.reviewedAt)}
                  </span>
                </div>
                {feedback.note && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-900">{feedback.note}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* アクション */}
      <ProjectReviewActions projectId={detail.id} status={detail.status} />
    </div>
  );
}
