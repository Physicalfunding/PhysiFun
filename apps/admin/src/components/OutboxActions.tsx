"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OutboxSource, OutboxStatus } from "@physifun/infrastructure";

interface OutboxActionsProps {
  id: string;
  source: OutboxSource;
  status: OutboxStatus;
}

export function OutboxActions({ id, source, status }: OutboxActionsProps) {
  const router = useRouter();
  const [isRetrying, setIsRetrying] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // pending（未処理）と sent（送信済み）はアクション不要
  if (status === "sent" || status === "pending") return null;

  async function handleRetry() {
    if (!window.confirm("このメッセージをリトライ対象に戻しますか？")) return;

    setIsRetrying(true);
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

      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setIsRetrying(false);
    }
  }

  async function handleComplete() {
    if (!window.confirm("このメッセージを完了としてマークしますか？この操作は取り消せません。")) {
      return;
    }

    setIsCompleting(true);
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

      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setIsCompleting(false);
    }
  }

  const isProcessing = isRetrying || isCompleting;

  return (
    <div className="flex items-center gap-2">
      {(status === "retrying" || status === "dead-lettered") && (
        <button
          type="button"
          onClick={handleRetry}
          disabled={isProcessing}
          className="rounded border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
        >
          {isRetrying ? "処理中..." : "リトライ"}
        </button>
      )}
      <button
        type="button"
        onClick={handleComplete}
        disabled={isProcessing}
        className="rounded border border-gray-300 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
      >
        {isCompleting ? "処理中..." : "完了にする"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
