import { ProjectDetail } from "@/components/my/projects/ProjectDetail";

export const metadata = {
  title: "プロジェクト詳細 | PhysiFun",
  description: "プロジェクトの詳細情報",
};

export default async function MyProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <ProjectDetail projectId={projectId} />
    </div>
  );
}
