"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface MemberRowActionsProps {
  memberId: string;
  memberEmail: string;
  isActive: boolean;
  isSelf: boolean;
}

/**
 * 運営メンバー 1 行分のアクション (#148)
 *
 * - ACTIVE メンバー: 「無効化」ボタン (自分自身には表示しない)
 * - DISABLED メンバー: 「再有効化」ボタン
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

  async function handleDisable() {
    if (
      !window.confirm(
        `${memberEmail} を無効化しますか？このアカウントのセッションは即時に失効します。`
      )
    ) {
      return;
    }
    await callAction("disable");
  }

  async function handleEnable() {
    if (!window.confirm(`${memberEmail} を再有効化しますか？`)) return;
    await callAction("enable");
  }

  async function callAction(action: "disable" | "enable") {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${memberId}/${action}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message ?? `${action} に失敗しました`);
        return;
      }
      router.refresh();
    } catch {
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
          onClick={handleDisable}
          disabled={isLoading}
          className="rounded-md border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          data-testid={`disable-member-${memberId}`}
        >
          {isLoading ? "処理中..." : "無効化"}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleEnable}
          disabled={isLoading}
          className="rounded-md border border-green-300 bg-white px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
          data-testid={`enable-member-${memberId}`}
        >
          {isLoading ? "処理中..." : "再有効化"}
        </button>
      )}
    </div>
  );
}
