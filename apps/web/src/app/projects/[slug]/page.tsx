import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicProjectQueryService } from "@/lib/di/project";
import { ProjectPublicView } from "@/components/project/ProjectPublicView";

const queryService = getPublicProjectQueryService();

/** React.cache でリクエスト単位にメモ化し、generateMetadata + page の二重クエリを防ぐ */
const getProject = cache((slug: string) => queryService.findPublishedBySlug(slug));

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProject(slug);

  if (!project) {
    return { title: "プロジェクトが見つかりません | PhysiFun" };
  }

  return {
    title: `${project.title} | PhysiFun`,
    description: project.summary ?? undefined,
    // Phase 1 では noindex: SEO/OGP は Phase 2 で対応予定（Issue #82 仕様）
    robots: { index: false, follow: false },
  };
}

export default async function ProjectPublicPage({ params }: Props) {
  const { slug } = await params;
  const project = await getProject(slug);

  if (!project) {
    notFound();
  }

  return <ProjectPublicView project={project} />;
}
