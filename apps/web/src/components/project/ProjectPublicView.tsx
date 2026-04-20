import type { ProjectPublicDetailDTO } from "@physifun/application";
import type { ProjectPhase } from "@physifun/domain";
import { Card, CardContent } from "@/components/common";
import { PROJECT_PHASE_LABEL, CATEGORY_LABEL } from "@/lib/project-labels";
import { PREFECTURES } from "@/lib/prefectures";
import { SafeSnsLink, isSafeHttpsUrl } from "@physifun/ui-shared";
import { ProjectPublicTabs } from "./ProjectPublicTabs";

const PREFECTURE_MAP: Record<string, string> = Object.fromEntries(
  PREFECTURES.map((p) => [p.code, p.name])
);

const SNS_LABEL: Record<string, string> = {
  x: "X (Twitter)",
  instagram: "Instagram",
  facebook: "Facebook",
  website: "ウェブサイト",
};

/**
 * 未実装タブ向けの「準備中」プレースホルダパネル。
 * モジュールスコープに配置することで、render のたびに関数を再生成しないようにしている。
 */
const placeholderPanel = (title: string) => (
  <Card>
    <CardContent className="py-16 text-center">
      <p className="text-gray-400 text-lg">準備中</p>
      <p className="text-gray-400 text-sm mt-2">{title}</p>
    </CardContent>
  </Card>
);

interface Props {
  project: ProjectPublicDetailDTO;
}

/**
 * プロジェクト公開ページの Server Component。
 * データ整形と各タブの表示 JSX を生成し、タブ切り替え UI は子 Client Component
 * (ProjectPublicTabs) に委譲することでハイドレーションコストを抑える。
 */
export function ProjectPublicView({ project }: Props) {
  const locationParts: string[] = [];
  if (project.prefectureCode && PREFECTURE_MAP[project.prefectureCode]) {
    locationParts.push(PREFECTURE_MAP[project.prefectureCode]);
  }
  if (project.municipality) {
    locationParts.push(project.municipality);
  }
  const locationText = locationParts.join(" ");

  const snsEntries = project.snsLinks
    ? Object.entries(project.snsLinks).filter(
        (entry): entry is [string, string] => entry[1] != null && entry[1] !== ""
      )
    : [];

  const homePanel = (
    <>
      {project.body && (
        <Card>
          <CardContent>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">プロジェクト詳細</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {project.body}
            </p>
          </CardContent>
        </Card>
      )}

      {project.activityPlan && (
        <Card>
          <CardContent>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">活動計画</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {project.activityPlan}
            </p>
          </CardContent>
        </Card>
      )}

      {/* リーダー紹介 */}
      <Card>
        <CardContent>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">リーダー紹介</h3>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600 font-bold text-sm">
              {project.leader.displayName.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">{project.leader.displayName}</p>
              {project.leaderIntroduction && (
                <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                  {project.leaderIntroduction}
                </p>
              )}
              {project.leader.bio && !project.leaderIntroduction && (
                <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                  {project.leader.bio}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SNS リンク — defense-in-depth: SafeSnsLink 内部で javascript: 等を遮断 */}
      {snsEntries.length > 0 && (
        <Card>
          <CardContent>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">SNS / ウェブサイト</h3>
            <ul className="space-y-2">
              {snsEntries.map(([key, url]) => (
                <li key={key}>
                  <SafeSnsLink label={SNS_LABEL[key] || key} url={url} variant="listItem" />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      {/* ヘッダーセクション */}
      <div>
        {/* カバー画像 */}
        <div className="h-48 w-full overflow-hidden rounded-xl bg-gray-100 sm:h-64">
          {project.coverImageUrl && isSafeHttpsUrl(project.coverImageUrl) ? (
            /* eslint-disable-next-line @next/next/no-img-element -- Issue #120 で next/image + allowlist 移行予定 */
            <img
              src={project.coverImageUrl}
              alt={project.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-400">
              <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

        {/* プロジェクト情報 */}
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
              {PROJECT_PHASE_LABEL[project.phase as ProjectPhase]}
            </span>
            {project.category && (
              <span className="text-sm text-gray-500">
                {CATEGORY_LABEL[project.category] || project.category}
              </span>
            )}
            {locationText && <span className="text-sm text-gray-500">{locationText}</span>}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{project.title}</h1>
          {project.summary && <p className="mt-2 text-gray-600">{project.summary}</p>}
        </div>
      </div>

      <ProjectPublicTabs
        home={homePanel}
        support={placeholderPanel("サポート募集機能は今後公開予定です")}
        report={placeholderPanel("活動報告機能は今後公開予定です")}
        supporters={placeholderPanel("サポーター一覧は今後公開予定です")}
      />
    </div>
  );
}
