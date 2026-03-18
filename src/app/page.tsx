import { prisma } from "@/infrastructure/database/prisma";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";
import { GetPublishedProjectsUseCase } from "@/application/use-cases/project/GetPublishedProjectsUseCase";
import { ProjectCard, ProjectCardProps } from "@/components/project/ProjectCard";
import { getCurrentPhase } from "@/lib/phase";
import { Phase1LP } from "@/components/top/Phase1LP";

/**
 * ISR（Incremental Static Regeneration）設定
 * ページを60秒間キャッシュし、バックグラウンドで再生成
 *
 * @see https://nextjs.org/docs/app/building-your-application/data-fetching/incremental-static-regeneration
 */
export const revalidate = 60;

/**
 * ホームページ（トップページ）
 *
 * フェーズに応じて表示を切り替え:
 * - Phase 1: オーナー募集 LP（応募フォームへの導線）
 * - Phase 2+: プロジェクト一覧
 */
export default async function Home() {
  const phase = getCurrentPhase();

  if (phase === 1) {
    return <Phase1LP />;
  }

  return <ProjectListPage />;
}

/**
 * Phase 2+: プロジェクト一覧ページ
 */
async function ProjectListPage() {
  const projectRepository = new PrismaProjectRepository(prisma);
  const useCase = new GetPublishedProjectsUseCase(projectRepository);
  const result = await useCase.execute();

  const projects: ProjectCardProps[] = result.success ? result.data.projects : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      {/* ヒーローセクション */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-500 opacity-10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 tracking-tight">
              <span className="text-orange-600">フィジ</span>
              <span className="text-amber-600">ファン</span>
            </h1>
            <p className="mt-2 text-base text-gray-500 tracking-widest">フィジカルファンディング</p>

            <p className="mt-4 text-xl sm:text-2xl text-gray-700 font-medium">
              お金じゃなくて、スキルと時間でプロジェクトを応援しよう
            </p>

            <p className="mt-6 max-w-2xl mx-auto text-base sm:text-lg text-gray-600">
              プロジェクトオーナーとサポーターをつなぐマッチングプラットフォーム。
              古民家再生、米作り、DIYなど、あなたのスキルと時間でプロジェクトを支援し、リターンを受け取りませんか？
            </p>
          </div>
        </div>

        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2">
          <div className="w-16 h-16 rounded-full bg-orange-500 opacity-20 animate-pulse" />
        </div>
      </header>

      {/* プロジェクト一覧セクション */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">公開中のプロジェクト</h2>
          <p className="mt-2 text-gray-600">
            スキルと時間で応援できるプロジェクトを探してみましょう
          </p>
        </div>

        {projects.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project, index) => (
              <ProjectCard key={project.id} {...project} priority={index < 3} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 mb-6">
              <svg
                className="w-10 h-10 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              公開中のプロジェクトはまだありません
            </h3>
            <p className="text-gray-500 max-w-md mx-auto">
              オーナーがプロジェクトを公開するまでお待ちください。
              自分でプロジェクトを立ち上げたい方は、ぜひオーナーとして登録してください。
            </p>
          </div>
        )}
      </main>

      {/* フッター */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-sm text-gray-500">
            &copy; {new Date().getFullYear()} フィジファン. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
