import Image from "next/image";
import type { ProjectPublicDetailDTO } from "@physifun/application";
import { PREFECTURE_MASTER, type ProjectPhase } from "@physifun/domain";
import { Card, CardContent } from "@/components/common";
import { PROJECT_PHASE_LABEL, CATEGORY_LABEL } from "@/lib/project-labels";
import { isAllowedImageUrl } from "@physifun/ui-shared";
import { ProjectHomePanel } from "./ProjectHomePanel";
import { ProjectPublicTabs } from "./ProjectPublicTabs";

const PREFECTURE_MAP: Record<string, string> = Object.fromEntries(
  PREFECTURE_MASTER.map((p) => [p.code, p.name])
);

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

  const homePanel = (
    <ProjectHomePanel
      body={project.body}
      leaderIntroduction={project.leaderIntroduction}
      leader={project.leader}
      snsLinks={project.snsLinks}
      activityPlan={project.activityPlan}
    />
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      {/* ヘッダーセクション */}
      <div>
        {/* カバー画像 — Supabase Storage ホスト allowlist + SSRF 防御（Issue #120） */}
        <div className="relative h-48 w-full overflow-hidden rounded-xl bg-gray-100 sm:h-64">
          {project.coverImageUrl && isAllowedImageUrl(project.coverImageUrl) ? (
            <Image
              src={project.coverImageUrl}
              alt={project.title}
              fill
              sizes="(min-width: 1024px) 1024px, 100vw"
              className="object-cover"
              priority
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
          {/* 概要はタイトルの下の短い紹介文として、左に線を付けて目立たせる（設計書 §5.6） */}
          {project.summary && (
            <p className="mt-2 border-l-4 border-orange-500 pl-3 text-gray-600 whitespace-pre-wrap">
              {project.summary}
            </p>
          )}
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
