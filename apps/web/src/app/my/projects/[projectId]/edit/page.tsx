import { ProjectEditForm } from "@/components/my/projects/ProjectEditForm";

export const metadata = {
  title: "プロジェクト編集 | PhysiFun",
  description: "プロジェクトの内容を編集",
};

export default async function MyProjectEditPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">プロジェクト編集</h1>
      <ProjectEditForm projectId={projectId} />
    </div>
  );
}
