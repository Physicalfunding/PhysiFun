"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

/**
 * ユーザー登録フォームのバリデーションスキーマ
 */
const registerFormSchema = z.object({
  email: z
    .string()
    .min(1, "メールアドレスを入力してください")
    .email("無効なメールアドレス形式です"),
  password: z
    .string()
    .min(8, "パスワードは8文字以上で入力してください"),
  confirmPassword: z.string(),
  name: z
    .string()
    .min(1, "名前を入力してください")
    .max(100, "名前は100文字以内で入力してください"),
  userType: z.enum(["HOST", "GUEST", "BOTH"], {
    errorMap: () => ({ message: "ユーザータイプを選択してください" }),
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "パスワードが一致しません",
  path: ["confirmPassword"],
});

type RegisterFormData = z.infer<typeof registerFormSchema>;

/**
 * RegisterForm
 * ユーザー登録フォームコンポーネント
 *
 * 機能:
 * - メールアドレス、パスワード、名前、ユーザータイプの入力
 * - クライアントサイドバリデーション
 * - エラーメッセージの表示
 * - 登録成功後の自動ログイン
 */
export function RegisterForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      userType: "GUEST",
    },
  });

  /**
   * フォーム送信ハンドラ
   */
  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setServerError(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          name: data.name,
          userType: data.userType,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // サーバーエラーの処理
        if (result.error?.code === "CONFLICT") {
          setError("email", { message: result.error.message });
        } else if (result.error?.fields) {
          // フィールドごとのエラー設定
          Object.entries(result.error.fields).forEach(([field, messages]) => {
            if (Array.isArray(messages) && messages.length > 0) {
              setError(field as keyof RegisterFormData, {
                message: messages[0],
              });
            }
          });
        } else {
          setServerError(result.error?.message || "登録に失敗しました");
        }
        return;
      }

      // 登録成功後、自動ログイン
      const signInResult = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (signInResult?.error) {
        // 自動ログイン失敗時はログインページへリダイレクト
        router.push("/login?registered=true");
        return;
      }

      // ログイン成功後、ホームへリダイレクト
      router.push("/");
      router.refresh();
    } catch (error) {
      setServerError("ネットワークエラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
          autoComplete="new-password"
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
        <p className="mt-1 text-xs text-gray-500">8文字以上で入力してください</p>
      </div>

      {/* パスワード確認 */}
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
          パスワード（確認）
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...register("confirmPassword")}
          className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 ${
            errors.confirmPassword
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-gray-300 focus:border-orange-500 focus:ring-orange-500"
          }`}
          aria-invalid={errors.confirmPassword ? "true" : "false"}
          aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
        />
        {errors.confirmPassword && (
          <p id="confirmPassword-error" className="mt-1 text-sm text-red-600">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      {/* ユーザー名 */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          表示名
        </label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          {...register("name")}
          className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 ${
            errors.name
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-gray-300 focus:border-orange-500 focus:ring-orange-500"
          }`}
          aria-invalid={errors.name ? "true" : "false"}
          aria-describedby={errors.name ? "name-error" : undefined}
        />
        {errors.name && (
          <p id="name-error" className="mt-1 text-sm text-red-600">
            {errors.name.message}
          </p>
        )}
      </div>

      {/* ユーザータイプ */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          利用目的
        </label>
        <div className="mt-2 space-y-2">
          <label className="flex items-center">
            <input
              type="radio"
              value="GUEST"
              {...register("userType")}
              className="h-4 w-4 border-gray-300 text-orange-600 focus:ring-orange-500"
            />
            <span className="ml-2 text-sm text-gray-700">
              体験に参加したい（ゲスト）
            </span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="HOST"
              {...register("userType")}
              className="h-4 w-4 border-gray-300 text-orange-600 focus:ring-orange-500"
            />
            <span className="ml-2 text-sm text-gray-700">
              体験を提供したい（ホスト）
            </span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="BOTH"
              {...register("userType")}
              className="h-4 w-4 border-gray-300 text-orange-600 focus:ring-orange-500"
            />
            <span className="ml-2 text-sm text-gray-700">
              両方
            </span>
          </label>
        </div>
        {errors.userType && (
          <p className="mt-1 text-sm text-red-600">
            {errors.userType.message}
          </p>
        )}
      </div>

      {/* 送信ボタン */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? "登録中..." : "アカウントを作成"}
      </button>
    </form>
  );
}
