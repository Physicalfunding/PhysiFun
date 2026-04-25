"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertDialog } from "./ui/AlertDialog";

interface MemberRowActionsProps {
  memberId: string;
  memberEmail: string;
  isActive: boolean;
  isSelf: boolean;
}

type PendingAction = "disable" | "enable" | null;

/**
 * 運営メンバー 1 行分のアクション (#148)
 *
 * - ACTIVE メンバー: 「無効化」ボタン (自分自身には表示しない)
 * - DISABLED メンバー: 「再有効化」ボタン
 *
 * 破壊的操作は AlertDialog で確認する (#168)。
 */
export function MemberRowActions({
  memberId,
  memberEmail,
  isActive,
  isSelf,
}: MemberRowActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);

  function requestDisable() {
    setError(null);
    setPending("disable");
  }

  function requestEnable() {
    setError(null);
    setPending("enable");
  }

  function closeDialog() {
    if (isLoading) return;
    setPending(null);
  }

  async function confirmAction() {
    if (!pending) return;
    const action = pending;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${memberId}/${action}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.success) {
        setPending(null);
        setError(data.error?.message ?? `${action} に失敗しました`);
        return;
      }
      setPending(null);
      router.refresh();
    } catch {
      setPending(null);
      setError("通信エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  }

  if (isSelf && isActive) {
    return <span className="text-xs text-gray-400">—</span>;
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {error && <span className="text-xs text-red-700">{error}</span>}
      {isActive ? (
        <button
          type="button"
          onClick={requestDisable}
          disabled={isLoading}
          className="rounded-md border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          data-testid={`disable-member-${memberId}`}
        >
          {isLoading && pending === "disable" ? "処理中..." : "無効化"}
        </button>
      ) : (
        <button
          type="button"
          onClick={requestEnable}
          disabled={isLoading}
          className="rounded-md border border-green-300 bg-white px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
          data-testid={`enable-member-${memberId}`}
        >
          {isLoading && pending === "enable" ? "処理中..." : "再有効化"}
        </button>
      )}

      <AlertDialog
        open={pending === "disable"}
        title="運営メンバーを無効化"
        description={`${memberEmail} を無効化しますか？このアカウントのセッションは即時に失効します。`}
        confirmLabel="無効化する"
        variant="destructive"
        isSubmitting={isLoading}
        onConfirm={confirmAction}
        onCancel={closeDialog}
        testId={`confirm-disable-member-${memberId}`}
      />
      <AlertDialog
        open={pending === "enable"}
        title="運営メンバーを再有効化"
        description={`${memberEmail} を再有効化しますか？`}
        confirmLabel="再有効化する"
        variant="default"
        isSubmitting={isLoading}
        onConfirm={confirmAction}
        onCancel={closeDialog}
        testId={`confirm-enable-member-${memberId}`}
      />
    </div>
  );
}
