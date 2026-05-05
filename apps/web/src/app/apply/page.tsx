import type { Metadata } from "next";
import { ApplyForm } from "@/components/apply/ApplyForm";

export const metadata: Metadata = {
  title: "リーダー応募 | フィジファン",
  description: "フィジファンのプロジェクトリーダーに応募して、あなたのプロジェクトを始めましょう。",
};

/**
 * /apply ページ
 * リーダー応募フォームを表示する Server Component ラッパー
 */
export default function ApplyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">リーダー応募フォーム</h1>
      <p className="mb-8 text-sm text-gray-600">
        プロジェクトリーダーとして応募するには、以下のフォームに必要事項を入力してください。
      </p>
      <ApplyForm />
    </div>
  );
}
