"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OutboxSource, OutboxStatus } from "@physifun/infrastructure";
import { AlertDialog } from "./ui/AlertDialog";

interface OutboxActionsProps {
  id: string;
  source: OutboxSource;
  status: OutboxStatus;
}

type PendingAction = "retry" | "complete" | null;

export function OutboxActions({ id, source, status }: OutboxActionsProps) {
  const router = useRouter();
  // MemberRowActions と揃え、`isLoading` + `pending` の 2 変数に統一
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);

  // pending（未処理）と sent（送信済み）はアクション不要
  if (status === "sent" || status === "pending") return null;

  function requestRetry() {
    setError(null);
    setPending("retry");
  }

  function requestComplete() {
    setError(null);
    setPending("complete");
  }

  function closeDialog() {
    if (isLoading) return;
    setPending(null);
  }

  async function handleRetry() {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/outbox/${id}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message ?? "リトライに失敗しました");
        return;
      }

      setPending(null);
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleComplete() {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/outbox/${id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message ?? "完了マークに失敗しました");
        return;
      }

      setPending(null);
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  }

  const isRetrying = isLoading && pending === "retry";
  const isCompleting = isLoading && pending === "complete";

  return (
    <div className="flex items-center gap-2">
      {(status === "retrying" || status === "dead-lettered") && (
        <button
          type="button"
          onClick={requestRetry}
          disabled={isLoading}
          className="rounded border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
        >
          {isRetrying ? "処理中..." : "リトライ"}
        </button>
      )}
      <button
        type="button"
        onClick={requestComplete}
        disabled={isLoading}
        className="rounded border border-gray-300 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
      >
        {isCompleting ? "処理中..." : "完了にする"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}

      <AlertDialog
        open={pending === "retry"}
        title="メッセージをリトライ"
        description="このメッセージをリトライ対象に戻しますか？"
        confirmLabel="リトライする"
        variant="default"
        isSubmitting={isRetrying}
        onConfirm={handleRetry}
        onCancel={closeDialog}
        testId={`confirm-retry-outbox-${id}`}
      />
      <AlertDialog
        open={pending === "complete"}
        title="メッセージを完了マーク"
        description="このメッセージを完了としてマークしますか？この操作は取り消せません。"
        confirmLabel="完了にする"
        variant="destructive"
        isSubmitting={isCompleting}
        onConfirm={handleComplete}
        onCancel={closeDialog}
        testId={`confirm-complete-outbox-${id}`}
      />
    </div>
  );
}
