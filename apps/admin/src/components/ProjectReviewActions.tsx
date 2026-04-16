"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PublishStatus } from "@physifun/domain";

interface ProjectReviewActionsProps {
  projectId: string;
  status: PublishStatus;
}

const REVIEWER_NOTE_MAX_LENGTH = 2000;

type ModalKind = "reject" | "forceUnpublish" | null;

/**
 * プロジェクト公開審査アクション
 *
 * PublishStatus に応じて表示するボタンを出し分ける:
 * - PENDING_REVIEW: 承認 / 差戻
 * - PUBLISHED    : 強制非公開
 * - DRAFT        : 「アクションなし」メッセージ
 *
 * 差戻・強制非公開は reviewerNote を textarea モーダルで必須入力（1〜2000 文字）、
 * 承認は window.confirm のみ。成功後は router.refresh() で一覧・詳細を再取得する。
 */
export function ProjectReviewActions({ projectId, status }: ProjectReviewActionsProps) {
  const router = useRouter();
  const [isApproving, setIsApproving] = useState(false);
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [reviewerNote, setReviewerNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isAnyPending = isApproving || isSubmittingNote;

  function openModal(kind: Exclude<ModalKind, null>) {
    setModal(kind);
    setReviewerNote("");
    setError(null);
  }

  function closeModal() {
    setModal(null);
    setReviewerNote("");
    setError(null);
  }

  async function handleApprove() {
    if (
      !window.confirm("このプロジェクトを承認して公開しますか？承認すると即座に公開されます。")
    ) {
      return;
    }

    setIsApproving(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/projects/${projectId}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message ?? "承認に失敗しました");
        return;
      }
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setIsApproving(false);
    }
  }

  async function submitReviewerNote(kind: Exclude<ModalKind, null>) {
    if (reviewerNote.trim().length === 0) {
      setError(kind === "reject" ? "差戻理由を入力してください" : "強制非公開理由を入力してください");
      return;
    }
    if (reviewerNote.length > REVIEWER_NOTE_MAX_LENGTH) {
      setError(`${REVIEWER_NOTE_MAX_LENGTH} 文字以内で入力してください`);
      return;
    }

    setIsSubmittingNote(true);
    setError(null);

    const endpoint =
      kind === "reject"
        ? `/api/admin/projects/${projectId}/reject`
        : `/api/admin/projects/${projectId}/force-unpublish`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewerNote }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message ?? (kind === "reject" ? "差戻に失敗しました" : "強制非公開に失敗しました"));
        return;
      }
      closeModal();
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setIsSubmittingNote(false);
    }
  }

  // DRAFT のときはアクションなしメッセージのみ
  if (status === "DRAFT") {
    return (
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-2 text-lg font-semibold">審査アクション</h2>
        <p className="text-sm text-gray-500">
          下書きのプロジェクトには運営側で行える操作はありません。
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">審査アクション</h2>

        {error && modal === null && (
          <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {status === "PENDING_REVIEW" && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleApprove}
              disabled={isAnyPending}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {isApproving ? "承認中..." : "承認する"}
            </button>
            <button
              type="button"
              onClick={() => openModal("reject")}
              disabled={isAnyPending}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              差戻す
            </button>
          </div>
        )}

        {status === "PUBLISHED" && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => openModal("forceUnpublish")}
              disabled={isAnyPending}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              強制非公開にする
            </button>
          </div>
        )}
      </section>

      {modal !== null && (
        <ReviewerNoteModal
          kind={modal}
          reviewerNote={reviewerNote}
          onChange={setReviewerNote}
          onCancel={closeModal}
          onSubmit={() => submitReviewerNote(modal)}
          isSubmitting={isSubmittingNote}
          error={error}
        />
      )}
    </>
  );
}

/**
 * 差戻 / 強制非公開の reviewerNote 入力モーダル
 */
function ReviewerNoteModal({
  kind,
  reviewerNote,
  onChange,
  onCancel,
  onSubmit,
  isSubmitting,
  error,
}: {
  kind: "reject" | "forceUnpublish";
  reviewerNote: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  error: string | null;
}) {
  const title = kind === "reject" ? "差戻理由を入力" : "強制非公開理由を入力";
  const placeholder =
    kind === "reject"
      ? "差戻理由を入力してください（必須）"
      : "強制非公開理由を入力してください（必須）";
  const submitLabel = kind === "reject" ? "差戻す" : "強制非公開にする";
  const submittingLabel = kind === "reject" ? "差戻中..." : "非公開処理中...";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold">{title}</h3>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <textarea
          value={reviewerNote}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={5}
          maxLength={REVIEWER_NOTE_MAX_LENGTH}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <p className="mt-1 text-right text-xs text-gray-400">
          {reviewerNote.length} / {REVIEWER_NOTE_MAX_LENGTH} 文字
        </p>

        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            disabled={isSubmitting}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting || reviewerNote.trim().length === 0}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isSubmitting ? submittingLabel : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
