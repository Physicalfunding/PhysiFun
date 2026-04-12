"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useToast } from "@/components/common/Toast";

/**
 * パスワード設定フォームのバリデーションスキーマ
 */
const activateFormSchema = z
  .object({
    password: z
      .string()
      .min(8, "パスワードは8文字以上で入力してください")
      .max(128, "パスワードは128文字以内で入力してください")
      .regex(/[a-zA-Z]/, "パスワードには英字を含めてください")
      .regex(/[0-9]/, "パスワードには数字を含めてください"),
    confirmPassword: z.string().min(1, "パスワード確認を入力してください"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "パスワードが一致しません",
    path: ["confirmPassword"],
  });

type ActivateFormData = z.infer<typeof activateFormSchema>;

type ViewState = "form" | "success" | "error";

interface ActivateFormProps {
  token: string | null;
}

/**
 * ActivateForm
 * アカウント有効化フォームコンポーネント
 *
 * 機能:
 * - パスワード入力・確認
 * - クライアントサイドバリデーション
 * - API呼び出しによるアカウント有効化
 * - 成功/エラー画面の表示
 */
export function ActivateForm({ token }: ActivateFormProps) {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [viewState, setViewState] = useState<ViewState>(token ? "form" : "error");
  const [errorMessage, setErrorMessage] = useState<string>(
    token ? "" : "無効なアクティベーションリンクです"
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ActivateFormData>({
    resolver: zodResolver(activateFormSchema),
  });

  const onSubmit = async (data: ActivateFormData) => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: data.password }),
      });

      const result = await response.json();

      if (!response.ok) {
        const code = result.error?.code;
        const message = result.error?.message;

        if (code === "NOT_FOUND") {
          setErrorMessage("無効なアクティベーションリンクです");
          setViewState("error");
        } else if (code === "UNPROCESSABLE_ENTITY") {
          setErrorMessage(message || "トークンの有効期限が切れています。再度応募してください。");
          setViewState("error");
        } else if (code === "CONFLICT") {
          setErrorMessage(message || "このアカウントは既に有効化されています");
          setViewState("error");
        } else {
          showToast(message || "エラーが発生しました", "error");
        }
        return;
      }

      setViewState("success");
    } catch {
      showToast("通信エラーが発生しました", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // エラー画面
  if (viewState === "error") {
    return (
      <div className="text-center">
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
        <div className="mt-6">
          <Link href="/login" className="font-medium text-orange-600 hover:text-orange-500">
            ログインページへ
          </Link>
        </div>
      </div>
    );
  }

  // 成功画面
  if (viewState === "success") {
    return (
      <div className="text-center">
        <div className="rounded-md bg-green-50 p-4">
          <p className="text-sm text-green-700">
            アカウントが有効化されました。ログインしてください。
          </p>
        </div>
        <div className="mt-6">
          <Link
            href="/login"
            className="inline-block w-full rounded-md bg-orange-600 px-4 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
          >
            ログインページへ
          </Link>
        </div>
      </div>
    );
  }

  // フォーム画面
  return (
    <div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
        </div>

        {/* パスワード確認 */}
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
            パスワード確認
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

        {/* 送信ボタン */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "有効化中..." : "アカウントを有効化"}
        </button>
      </form>

      {/* パスワード要件 */}
      <div className="mt-4">
        <p className="text-xs text-gray-500">パスワード要件:</p>
        <ul className="mt-1 list-inside list-disc text-xs text-gray-500">
          <li>8文字以上128文字以内</li>
          <li>英字を含む</li>
          <li>数字を含む</li>
        </ul>
      </div>
    </div>
  );
}
