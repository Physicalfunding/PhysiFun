import { Suspense } from "react";
import { ActivateForm } from "@/components/activate/ActivateForm";

export const metadata = {
  title: "アカウント有効化 | PhysiFun",
  description: "パスワードを設定してアカウントを有効化します",
};

/**
 * アカウント有効化ページ
 *
 * URL パラメータ ?token=xxx からトークンを取得し、
 * パスワード設定フォームを表示する。
 */
export default function ActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  return (
    <div className="flex min-h-screen flex-col justify-center bg-gray-50 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center text-3xl font-bold tracking-tight text-gray-900">
          フィジファン
        </h1>
        <h2 className="mt-6 text-center text-2xl font-semibold text-gray-900">アカウント有効化</h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white px-4 py-8 shadow sm:rounded-lg sm:px-10">
          <Suspense fallback={<ActivateFormSkeleton />}>
            <ActivateFormWrapper searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function ActivateFormWrapper({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return <ActivateForm token={params.token ?? null} />;
}

function ActivateFormSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div>
        <div className="mb-2 h-4 w-24 rounded bg-gray-200"></div>
        <div className="h-10 rounded bg-gray-200"></div>
      </div>
      <div>
        <div className="mb-2 h-4 w-28 rounded bg-gray-200"></div>
        <div className="h-10 rounded bg-gray-200"></div>
      </div>
      <div className="h-10 rounded bg-gray-200"></div>
    </div>
  );
}
