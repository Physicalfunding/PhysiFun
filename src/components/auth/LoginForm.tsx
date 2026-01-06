"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * ログインフォームのバリデーションスキーマ
 */
const loginFormSchema = z.object({
  email: z
    .string()
    .min(1, "メールアドレスを入力してください")
    .email("無効なメールアドレス形式です"),
  password: z
    .string()
    .min(1, "パスワードを入力してください"),
});

type LoginFormData = z.infer<typeof loginFormSchema>;

/**
 * LoginForm
 * ログインフォームコンポーネント
 *
 * 機能:
 * - メールアドレス、パスワードの入力
 * - クライアントサイドバリデーション
 * - NextAuth.jsによる認証
 * - エラーメッセージの表示
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // 登録完了後のリダイレクトかどうかを確認
  const isRegistered = searchParams.get("registered") === "true";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginFormSchema),
  });

  /**
   * フォーム送信ハンドラ
   */
  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setServerError(null);

    try {
      // NextAuth.jsのsignIn関数を使用して認証
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false, // リダイレクトを手動で制御
      });

      if (result?.error) {
        setServerError("メールアドレスまたはパスワードが正しくありません");
        return;
      }

      // ログイン成功後、リダイレクト
      const callbackUrl = searchParams.get("callbackUrl") || "/";
      router.push(callbackUrl);
      router.refresh(); // セッション状態を更新
    } catch (error) {
      setServerError("ログインに失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* 登録完了メッセージ */}
      {isRegistered && (
        <div className="rounded-md bg-green-50 p-4">
          <p className="text-sm text-green-700">
            アカウントが作成されました。ログインしてください。
          </p>
        </div>
      )}

      {/* サーバーエラー表示 */}
      {serverError && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{serverError}</p>
        </div>
      )}

      {/* メールアドレス */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          メールアドレス
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          {...register("email")}
          className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 ${
            errors.email
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-gray-300 focus:border-orange-500 focus:ring-orange-500"
          }`}
          aria-invalid={errors.email ? "true" : "false"}
          aria-describedby={errors.email ? "email-error" : undefined}
        />
        {errors.email && (
          <p id="email-error" className="mt-1 text-sm text-red-600">
            {errors.email.message}
          </p>
        )}
      </div>

      {/* パスワード */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          パスワード
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
          className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 ${
            errors.password
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-gray-300 focus:border-orange-500 focus:ring-orange-500"
          }`}
          aria-invalid={errors.password ? "true" : "false"}
          aria-describedby={errors.password ? "password-error" : undefined}
        />
        {errors.password && (
          <p id="password-error" className="mt-1 text-sm text-red-600">
            {errors.password.message}
          </p>
        )}
      </div>

      {/* 送信ボタン */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? "ログイン中..." : "ログイン"}
      </button>
    </form>
  );
}
