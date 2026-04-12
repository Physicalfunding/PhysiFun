import { ApplicationStatus } from "@/components/my/ApplicationStatus";

/**
 * /my/application - 応募状況ページ
 *
 * Server Component ラッパー。
 * 実際のデータ取得・表示はクライアントコンポーネントに委譲する。
 */
export default function MyApplicationPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">応募状況</h1>
      <ApplicationStatus />
    </div>
  );
}
