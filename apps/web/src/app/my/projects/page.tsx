import { ProjectList } from "@/components/my/projects/ProjectList";

export const metadata = {
  title: "マイプロジェクト | PhysiFun",
  description: "プロジェクトの一覧と管理",
};

export default function MyProjectsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        マイプロジェクト
      </h1>
      <ProjectList />
    </div>
  );
}
