"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ReviewActionsProps {
  applicationId: string;
}

/**
 * 審査アクション（承認/却下）
 *
 * PENDING 状態の応募詳細ページで表示される。
 * 承認は確認ダイアログ、却下は理由入力モーダルを経由する。
 */
export function ReviewActions({ applicationId }: ReviewActionsProps) {
  const router = useRouter();
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [reviewerNote, setReviewerNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    if (!window.confirm("この応募を承認しますか？承認すると応募者にリーダー権限が付与されます。")) {
      return;
    }

    setIsApproving(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/applications/${applicationId}/approve`, {
        method: "POST",
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message ?? "承認に失敗しました");
        return;
      }

      router.refresh();
    } catch {
      setError("通信エラ���が発生しました");
    } finally {
      setIsApproving(false);
    }
  }

  async function handleReject() {
    if (reviewerNote.trim().length === 0) {
      setError("却下理由を��力してください");
      return;
    }

    setIsRejecting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/applications/${applicationId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewerNote }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message ?? "却下に失敗しました");
        return;
      }

      setShowRejectModal(false);
      router.refresh();
    } catch {
      setError("���信エラーが発生しました");
    } finally {
      setIsRejecting(false);
    }
  }

  return (
    <>
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">審査アクション</h2>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleApprove}
            disabled={isApproving}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isApproving ? "承認中..." : "承認する"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowRejectModal(true);
              setError(null);
            }}
            disabled={isRejecting}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            却下する
          </button>
        </div>
      </section>

      {/* 却下理由モーダ��� */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">却下理由を入力</h3>

            {error && (
              <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <textarea
              value={reviewerNote}
              onChange={(e) => setReviewerNote(e.target.value)}
              placeholder="却下理由を入力してください（必須）"
              rows={5}
              maxLength={2000}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-right text-xs text-gray-400">
              {reviewerNote.length} / 2000 文字
            </p>

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setError(null);
                }}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={isRejecting || reviewerNote.trim().length === 0}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isRejecting ? "却下中..." : "却下する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
