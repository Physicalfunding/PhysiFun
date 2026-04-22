"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * 運営メンバー追加フォーム (#148)
 *
 * メールアドレスのみを入力して POST /api/admin/members を呼ぶ。
 * サーバ側で AdminAccountEmail.from による正規化・検証が行われるため、
 * クライアントは最低限 (空チェック) のみを行う。
 */
export function AddMemberForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (email.trim().length === 0) {
      setError("メールアドレスを入力してください");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!data.success) {
        const fields = data.error?.fields as Record<string, string[]> | undefined;
        const firstFieldError = fields ? Object.values(fields).flat()[0] : undefined;
        setError(firstFieldError ?? data.error?.message ?? "追加に失敗しました");
        return;
      }

      setSuccessMessage(`${data.data.email} を追加しました`);
      setEmail("");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="flex-1">
        <label htmlFor="member-email" className="sr-only">
          メールアドレス
        </label>
        <input
          id="member-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="member@example.com"
          maxLength={254}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          disabled={isSubmitting}
          data-testid="add-member-email-input"
        />
        {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
        {successMessage && <p className="mt-1 text-sm text-green-700">{successMessage}</p>}
      </div>
      <button
        type="submit"
        disabled={isSubmitting || email.trim().length === 0}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        data-testid="add-member-submit-button"
      >
        {isSubmitting ? "追加中..." : "追加"}
      </button>
    </form>
  );
}
