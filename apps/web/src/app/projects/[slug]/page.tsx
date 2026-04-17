import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PrismaProjectQueryService } from "@physifun/infrastructure";
import { ProjectPublicView } from "@/components/project/ProjectPublicView";

const queryService = new PrismaProjectQueryService();

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = await queryService.findPublishedBySlug(slug);

  if (!project) {
    return { title: "プロジェクトが見つかりません | PhysiFun" };
  }

  return {
    title: `${project.title} | PhysiFun`,
    description: project.summary ?? undefined,
    robots: { index: false, follow: false },
  };
}

export default async function ProjectPublicPage({ params }: Props) {
  const { slug } = await params;
  const project = await queryService.findPublishedBySlug(slug);

  if (!project) {
    notFound();
  }

  return <ProjectPublicView project={project} />;
}
