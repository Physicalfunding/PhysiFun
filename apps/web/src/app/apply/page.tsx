import type { Metadata } from "next";
import { ApplyForm } from "@/components/apply/ApplyForm";
import { isLeaderApplicationEnabledClient } from "@/lib/featureFlags";

export const metadata: Metadata = {
  title: "リーダー応募 | フィジファン",
  description: "フィジファンのプロジェクトリーダーに応募して、あなたのプロジェクトを始めましょう。",
};

/**
 * /apply ページ
 * リーダー応募フォームを表示する Server Component ラッパー
 *
 * Issue #192 PR #198 review C1:
 * 本番環境では CAPTCHA / レートリミット未実装のため、feature flag で
 * フォームを非表示（「準備中」表示）にする。
 */
export default function ApplyPage() {
  if (!isLeaderApplicationEnabledClient()) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">リーダー応募フォーム</h1>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-sm text-yellow-800">
          リーダー応募の受付は現在準備中です。公開までしばらくお待ちください。
        </div>
      </div>
    );
  }

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
