import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/infrastructure/database/prisma";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";
import { GetMyProjectUseCase } from "@/application/use-cases/project/GetMyProjectUseCase";
import { getCurrentUserId, isHost } from "@/lib/session";
import { ProjectEditForm } from "@/components/project/ProjectEditForm";
import { ProjectStatusToggle } from "@/components/project/ProjectStatusToggle";
import { ProjectImageUpload } from "@/components/project/ProjectImageUpload";

/**
 * マイプロジェクトページ
 * ホストが自分のプロジェクトを管理するページ
 */
export default async function MyProjectPage() {
  // 認証・権限チェック
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/login");
  }

  const hostPermission = await isHost();
  if (!hostPermission) {
    redirect("/my");
  }

  // プロジェクトを取得
  const projectRepository = new PrismaProjectRepository(prisma);
  const useCase = new GetMyProjectUseCase(projectRepository);
  const result = await useCase.execute(userId);

  // エラーの場合
  if (!result.success) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">プロジェクトの取得に失敗しました</p>
        </div>
      </div>
    );
  }

  const project = result.data;

  // プロジェクトがない場合は作成ページへ誘導
  if (!project) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">プロジェクトがありません</h1>
          <p className="text-gray-600 mb-8">
            まだプロジェクトを作成していません。
            <br />
            新しいプロジェクトを作成して、体験を共有しましょう。
          </p>
          <Link
            href="/my/project/new"
            className="inline-block px-6 py-3 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors"
          >
            プロジェクトを作成
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* ページヘッダー */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">マイプロジェクト</h1>
        <p className="mt-2 text-gray-600">
          プロジェクト情報を編集し、体験スケジュールやリターンを設定できます。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* メインコンテンツ: プロジェクト編集フォーム */}
        <div className="lg:col-span-2 space-y-8">
          {/* プロジェクト画像 */}
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">プロジェクト画像</h2>
            <ProjectImageUpload projectId={project.id} initialImages={project.imageUrls} />
          </div>

          {/* プロジェクト情報 */}
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">プロジェクト情報</h2>
            <ProjectEditForm project={project} />
          </div>
        </div>

        {/* サイドバー: ステータスと関連リンク */}
        <div className="space-y-6">
          {/* 公開ステータス */}
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">公開設定</h2>
            <ProjectStatusToggle projectId={project.id} status={project.status} />
          </div>

          {/* 関連リンク */}
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">プロジェクト管理</h2>
            <nav className="space-y-2">
              <Link
                href="/my/project/schedules"
                className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                体験スケジュール管理
              </Link>
              <Link
                href="/my/project/returns"
                className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                リターン設定
              </Link>
              <Link
                href="/my/project/participants"
                className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                参加者管理
              </Link>
              {project.status === "PUBLISHED" && project.slug && (
                <Link
                  href={`/projects/${project.id}`}
                  className="block px-4 py-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                  target="_blank"
                >
                  公開ページを見る →
                </Link>
              )}
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
