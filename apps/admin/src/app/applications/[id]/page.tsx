import { PROJECT_PHASE_LABELS, LeaderApplicationRecruitmentType } from "@physifun/domain";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ApplicationStatusBadge } from "@/components/ApplicationStatusBadge";
import { ReviewActions } from "@/components/ReviewActions";
import { SafeSnsLink } from "@physifun/ui-shared";
import { getAuthenticatedAdminId } from "@/lib/api/auth";
import { getCategoryLabel } from "@/lib/category";
import { getLeaderApplicationQueryService } from "@/lib/di/queryServices";
import { getRecruitmentTypeLabel } from "@/lib/leaderApplicationLabels";
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
 *
 * ## 表示構造 (Issue #192 PR6)
 * PR3 で追加された応募フォーム拡張フィールドに対応するため、以下の 5 セクション
 * グルーピングで詳細を表示する:
 *
 * 1. 応募者情報（お名前 / メール / 電話番号）
 * 2. プロジェクト詳細（カテゴリ / 活動地域 / 概要 / 説明 / SNS）
 * 3. プロジェクトの進捗（progress を日本語ラベルで表示）
 * 4. 募集内容（recruitmentTypes と TIME / SKILL_ITEM 条件付きフィールド）
 * 5. リターン（experienceOffered + 条件付き timeReturn / skillItemReturn）
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

  // 募集タイプ判定（条件付き表示の判定に利用）
  const includesTime = detail.recruitmentTypes.includes(LeaderApplicationRecruitmentType.TIME);
  const includesSkillItem = detail.recruitmentTypes.includes(
    LeaderApplicationRecruitmentType.SKILL_ITEM
  );
  // PR3 以前の旧データ (recruitmentTypes が空) では `activityContent` のみが
  // 任意項目として残っている。新スキーマだと TIME 配下にしか表示されないため、
  // 旧データ閲覧時は別枠で `activityContent` を表示する。
  const isLegacyApplication = detail.recruitmentTypes.length === 0;

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

      {/* 1. 応募者情報 */}
      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">応募者情報</h2>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">お名前</dt>
            <dd className="mt-1">{detail.displayName}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">メールアドレス</dt>
            <dd className="mt-1">{detail.email}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">電話番号</dt>
            <dd className="mt-1">{detail.phoneNumber ?? "（未入力）"}</dd>
          </div>
        </dl>
      </section>

      {/* 2. プロジェクト詳細 */}
      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">プロジェクト詳細</h2>
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
            <dt className="text-sm font-medium text-gray-500">プロジェクト説明（想い）</dt>
            <dd className="mt-1 whitespace-pre-wrap text-gray-900">{detail.projectStory}</dd>
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

      {/* 3. プロジェクトの進捗 */}
      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">プロジェクトの進捗</h2>
        <dl className="space-y-6">
          <div>
            <dt className="text-sm font-medium text-gray-500">現在のフェーズ</dt>
            <dd className="mt-1">{PROJECT_PHASE_LABELS[detail.progress]}</dd>
          </div>
        </dl>
      </section>

      {/* 4. 募集内容 */}
      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">募集内容</h2>
        <dl className="space-y-6">
          <div>
            <dt className="text-sm font-medium text-gray-500">募集タイプ</dt>
            <dd className="mt-1">
              {detail.recruitmentTypes.length === 0 ? (
                "（未選択）"
              ) : (
                <ul className="list-inside list-disc">
                  {detail.recruitmentTypes.map((type) => (
                    <li key={type}>{getRecruitmentTypeLabel(type)}</li>
                  ))}
                </ul>
              )}
            </dd>
          </div>

          {/* TIME 関連フィールド: TIME を含む場合のみ表示 */}
          {includesTime && (
            <>
              <div>
                <dt className="text-sm font-medium text-gray-500">活動内容</dt>
                <dd className="mt-1 whitespace-pre-wrap text-gray-900">
                  {detail.activityContent ?? "（未入力）"}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">開催場所</dt>
                <dd className="mt-1 whitespace-pre-wrap text-gray-900">
                  {detail.eventLocation ?? "（未入力）"}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">実施期間</dt>
                <dd className="mt-1 whitespace-pre-wrap text-gray-900">
                  {detail.eventPeriod ?? "（未入力）"}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">募集人数</dt>
                <dd className="mt-1 text-gray-900">
                  {detail.recruitCount !== null ? `${detail.recruitCount} 名` : "（未入力）"}
                </dd>
              </div>
            </>
          )}

          {/* SKILL_ITEM 関連フィールド: SKILL_ITEM を含む場合のみ表示 */}
          {includesSkillItem && (
            <>
              <div>
                <dt className="text-sm font-medium text-gray-500">募集したい内容</dt>
                <dd className="mt-1 whitespace-pre-wrap text-gray-900">
                  {detail.skillItemNeeds ?? "（未入力）"}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">期限</dt>
                <dd className="mt-1 whitespace-pre-wrap text-gray-900">
                  {detail.skillItemDeadline ?? "（未入力）"}
                </dd>
              </div>
            </>
          )}

          {/* 旧データ向けフォールバック: recruitmentTypes が空の場合 activityContent を表示 */}
          {isLegacyApplication && (
            <div>
              <dt className="text-sm font-medium text-gray-500">活動内容（旧データ）</dt>
              <dd className="mt-1 whitespace-pre-wrap text-gray-900">
                <p className="mb-1 text-xs text-amber-700">
                  ※ PR3 以前に提出された応募のため、募集タイプが未設定です。
                </p>
                {detail.activityContent ?? "（未入力）"}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* 5. リターン */}
      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">リターン</h2>
        <dl className="space-y-6">
          <div>
            <dt className="text-sm font-medium text-gray-500">体験できること</dt>
            <dd className="mt-1 whitespace-pre-wrap text-gray-900">
              {detail.experienceOffered ?? (
                <span className="text-red-600">⚠ 必須項目が未入力です</span>
              )}
            </dd>
          </div>

          {includesTime && (
            <div>
              <dt className="text-sm font-medium text-gray-500">
                時間用リターン（やる気で支援する人向け）
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-gray-900">
                {detail.timeReturn ?? "（未入力）"}
              </dd>
            </div>
          )}

          {includesSkillItem && (
            <div>
              <dt className="text-sm font-medium text-gray-500">
                スキル・モノ用リターン（スキルやモノで支援する人向け）
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-gray-900">
                {detail.skillItemReturn ?? "（未入力）"}
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
