import Link from "next/link";

/**
 * 応募が見つからない場合の 404 ページ
 */
export default function ApplicationNotFound() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-gray-900">この応募は見つかりません</h1>
      <p className="mt-4 text-gray-600">
        指定された応募は存在しないか、削除された可能性があります。
      </p>
      <Link
        href="/applications"
        className="mt-6 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        一覧に戻る
      </Link>
    </div>
  );
}
