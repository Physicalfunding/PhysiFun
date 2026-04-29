"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

/**
 * 運営管理ログインページ (#145)
 *
 * マジックリンク認証。メールアドレスを入力するとワンタイムリンクが送られる。
 * AdminAccount が存在し ACTIVE な場合のみリンクが有効化される。
 */
export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // NextAuth が検証後 /login/verify-request にリダイレクトする (pages.verifyRequest)。
      const result = await signIn("email", {
        email: email.trim().toLowerCase(),
        redirect: false,
      });

      if (result?.error) {
        setError("メール送信に失敗しました。時間をおいて再度お試しください。");
        return;
      }
      setSent(true);
    } catch {
      setError("ログイン中にエラーが発生しました。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-bold">運営管理ログイン</h1>

        {sent ? (
          <div className="mt-8 space-y-4 text-sm">
            <div className="rounded bg-blue-50 p-3 text-blue-800">
              入力されたメールアドレス宛にログインリンクを送信しました。 10
              分以内にリンクをクリックしてください。
            </div>
            <p className="text-gray-600">
              メールが届かない場合、AdminAccount が未登録または無効化されている可能性があります。
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            {error && <div className="rounded bg-red-50 p-3 text-sm text-red-600">{error}</div>}

            <div>
              <label htmlFor="email" className="block text-sm font-medium">
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? "送信中..." : "ログインリンクを送信"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
