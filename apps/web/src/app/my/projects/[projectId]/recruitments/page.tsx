import Link from "next/link";
import { RecruitmentManager } from "@/components/my/recruitments/RecruitmentManager";

export const metadata = {
  title: "サポート募集の管理 | PhysiFun",
  description: "プロジェクトのサポート募集を管理",
};

export default async function MyProjectRecruitmentsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href={`/my/projects/${projectId}`}
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        ← プロジェクトに戻る
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-bold text-gray-900">サポート募集の管理</h1>
      <RecruitmentManager projectId={projectId} />
    </div>
  );
}
