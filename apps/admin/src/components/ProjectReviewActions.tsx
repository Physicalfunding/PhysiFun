"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { PublishStatus } from "@physifun/domain";

interface ProjectReviewActionsProps {
  projectId: string;
  status: PublishStatus;
}

const REVIEWER_NOTE_MAX_LENGTH = 2000;

type ModalKind = "approve" | "reject" | "forceUnpublish" | null;

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
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [reviewerNote, setReviewerNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isAnyPending = isSubmittingNote;

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

  async function submitModalAction(kind: Exclude<ModalKind, null>) {
    // approve は note 任意、reject / forceUnpublish は必須
    if (kind !== "approve") {
      if (reviewerNote.trim().length === 0) {
        setError(
          kind === "reject" ? "差戻理由を入力してください" : "強制非公開理由を入力してください"
        );
        return;
      }
      if (reviewerNote.length > REVIEWER_NOTE_MAX_LENGTH) {
        setError(`${REVIEWER_NOTE_MAX_LENGTH} 文字以内で入力してください`);
        return;
      }
    }

    setIsSubmittingNote(true);
    setError(null);

    const endpointMap: Record<Exclude<ModalKind, null>, string> = {
      approve: `/api/admin/projects/${projectId}/approve`,
      reject: `/api/admin/projects/${projectId}/reject`,
      forceUnpublish: `/api/admin/projects/${projectId}/force-unpublish`,
    };
    const errorMsgMap: Record<Exclude<ModalKind, null>, string> = {
      approve: "承認に失敗しました",
      reject: "差戻に失敗しました",
      forceUnpublish: "強制非公開に失敗しました",
    };

    const bodyPayload: Record<string, string> =
      kind === "approve"
        ? reviewerNote.trim().length > 0
          ? { note: reviewerNote.trim() }
          : {}
        : { reviewerNote };

    try {
      const res = await fetch(endpointMap[kind], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message ?? errorMsgMap[kind]);
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
              onClick={() => openModal("approve")}
              disabled={isAnyPending}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              data-testid="approve-project-button"
            >
              承認する
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
          onSubmit={() => submitModalAction(modal)}
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
  kind: "approve" | "reject" | "forceUnpublish";
  reviewerNote: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  error: string | null;
}) {
  const titleMap = {
    approve: "プロジェクトを承認",
    reject: "差戻理由を入力",
    forceUnpublish: "強制非公開理由を入力",
  } as const;
  const placeholderMap = {
    approve: "コメント（任意）",
    reject: "差戻理由を入力してください（必須）",
    forceUnpublish: "強制非公開理由を入力してください（必須）",
  } as const;
  const submitLabelMap = {
    approve: "承認する",
    reject: "差戻す",
    forceUnpublish: "強制非公開にする",
  } as const;
  const submittingLabelMap = {
    approve: "承認中...",
    reject: "差戻中...",
    forceUnpublish: "非公開処理中...",
  } as const;
  const title = titleMap[kind];
  const placeholder = placeholderMap[kind];
  const submitLabel = submitLabelMap[kind];
  const submittingLabel = submittingLabelMap[kind];
  const isNoteRequired = kind !== "approve";
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = `modal-title-${kind}`;

  // Escape キーで閉じる + フォーカストラップ
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isSubmitting) {
        onCancel();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSubmitting, onCancel]);

  // 開いた時にダイアログにフォーカスを移す
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl outline-none"
      >
        <h3 id={titleId} className="mb-4 text-lg font-semibold">
          {title}
        </h3>

        {kind === "approve" && (
          <p className="mb-4 text-sm text-gray-600">
            このプロジェクトを承認して公開します。承認すると即座に公開されます。
          </p>
        )}

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
          {reviewerNote.trim().length} / {REVIEWER_NOTE_MAX_LENGTH} 文字
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
            disabled={isSubmitting || (isNoteRequired && reviewerNote.trim().length === 0)}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
              kind === "approve" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
            }`}
            data-testid={`confirm-${kind}-project`}
          >
            {isSubmitting ? submittingLabel : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
