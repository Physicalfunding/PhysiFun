import { ProjectCreateForm } from "@/components/project/ProjectCreateForm";

/**
 * プロジェクト新規作成ページ
 * ホスト権限を持つユーザーがプロジェクトを作成するためのページ
 *
 * 認証保護は/my配下のlayout.tsxで行われる
 */
export default function NewProjectPage() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* ページヘッダー */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">プロジェクトを作成</h1>
        <p className="mt-2 text-gray-600">
          新しいプロジェクトを作成して、サポーターを募集しましょう。
          作成後、スケジュールやリターンを設定できます。
        </p>
      </div>

      {/* 注意事項 */}
      <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex">
          <svg
            className="h-5 w-5 text-yellow-400 mr-2 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="text-sm text-yellow-700">
            <strong>注意:</strong> 1アカウントにつき作成できるプロジェクトは1つのみです。
          </p>
        </div>
      </div>

      {/* プロジェクト作成フォーム */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <ProjectCreateForm />
      </div>
    </div>
  );
}
