import Link from "next/link";
import { OwnerApplicationForm } from "@/components/application/OwnerApplicationForm";

/**
 * オーナー応募ページ
 * Phase 1 で公開されるオーナー募集フォーム
 */
export default function ApplyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        {/* ヘッダー */}
        <div className="text-center">
          <Link href="/" className="text-3xl font-bold tracking-tight text-orange-600">
            フィジファン
          </Link>
          <h1 className="mt-6 text-2xl font-semibold text-gray-900">オーナー応募フォーム</h1>
          <p className="mt-2 text-sm text-gray-600">
            スキルと時間でプロジェクトを応援してもらいたいオーナーを募集しています
          </p>
        </div>

        {/* フォームカード */}
        <div className="mt-8 bg-white px-4 py-8 shadow sm:rounded-lg sm:px-10">
          {/* 説明文 */}
          <div className="mb-8 rounded-md bg-orange-50 p-4">
            <h2 className="text-sm font-medium text-orange-800">フィジファンとは？</h2>
            <p className="mt-1 text-sm text-orange-700">
              フィジファンは、お金ではなくスキルと時間でプロジェクトを支援する
              「フィジカルファンディング」プラットフォームです。
              古民家再生、農業体験、地域イベントなど、
              あなたのプロジェクトに共感した人たちが実際に参加して応援します。
            </p>
          </div>

          <OwnerApplicationForm />
        </div>

        {/* フッター */}
        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            トップページに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
