"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useToast } from "@/components/common/Toast";

/**
 * オーナー応募フォームのバリデーションスキーマ
 */
const entryFormSchema = z.object({
  name: z
    .string()
    .min(1, "お名前を入力してください")
    .max(100, "お名前は100文字以内で入力してください"),
  email: z
    .string()
    .min(1, "メールアドレスを入力してください")
    .email("有効なメールアドレスを入力してください"),
  projectTitle: z
    .string()
    .min(1, "プロジェクトタイトルを入力してください")
    .max(200, "プロジェクトタイトルは200文字以内で入力してください"),
  projectSummary: z
    .string()
    .min(1, "プロジェクト概要を入力してください")
    .max(500, "プロジェクト概要は500文字以内で入力してください"),
  projectStory: z
    .string()
    .min(1, "プロジェクト説明を入力してください")
    .max(5000, "プロジェクト説明は5000文字以内で入力してください"),
});

type EntryFormData = z.infer<typeof entryFormSchema>;

/**
 * OwnerEntryForm
 * オーナー応募フォームコンポーネント
 *
 * 機能:
 * - 応募者情報とプロジェクト情報の入力
 * - クライアントサイドバリデーション
 * - エラーメッセージの表示
 * - 送信完了後の完了画面表示
 */
export function OwnerEntryForm() {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    watch,
  } = useForm<EntryFormData>({
    resolver: zodResolver(entryFormSchema),
  });

  // 文字数カウント用
  const projectSummary = watch("projectSummary", "");
  const projectStory = watch("projectStory", "");

  /**
   * フォーム送信ハンドラ
   */
  const onSubmit = async (data: EntryFormData) => {
    setIsLoading(true);
    setServerError(null);

    try {
      const response = await fetch("/api/entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        // サーバーエラーの処理
        if (result.error?.fields) {
          // フィールドごとのエラー設定
          Object.entries(result.error.fields).forEach(([field, messages]) => {
            if (Array.isArray(messages) && messages.length > 0) {
              setError(field as keyof EntryFormData, {
                message: messages[0],
              });
            }
          });
        } else {
          const errorMessage = result.error?.message || "応募の送信に失敗しました";
          setServerError(errorMessage);
          showToast(errorMessage, "error");
        }
        return;
      }

      // 送信成功
      setIsSubmitted(true);
      showToast("応募を受け付けました", "success");
    } catch {
      const errorMessage = "ネットワークエラーが発生しました";
      setServerError(errorMessage);
      showToast(errorMessage, "error");
    } finally {
      setIsLoading(false);
    }
  };

  // 送信完了画面
  if (isSubmitted) {
    return (
      <div className="text-center py-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-8 w-8 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="mt-4 text-xl font-semibold text-gray-900">応募を受け付けました</h3>
        <p className="mt-2 text-gray-600">
          ご応募ありがとうございます。
          <br />
          審査結果は、ご入力いただいたメールアドレス宛に
          <br />
          追ってご連絡いたします。
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-md bg-orange-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500"
        >
          トップページに戻る
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* サーバーエラー表示 */}
      {serverError && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{serverError}</p>
        </div>
      )}

      {/* お名前 */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          お名前 <span className="text-red-500">*</span>
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

      {/* メールアドレス */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          メールアドレス <span className="text-red-500">*</span>
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
        <p className="mt-1 text-xs text-gray-500">審査結果のご連絡に使用します</p>
      </div>

      {/* プロジェクトタイトル */}
      <div>
        <label htmlFor="projectTitle" className="block text-sm font-medium text-gray-700">
          プロジェクトタイトル <span className="text-red-500">*</span>
        </label>
        <input
          id="projectTitle"
          type="text"
          {...register("projectTitle")}
          className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 ${
            errors.projectTitle
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-gray-300 focus:border-orange-500 focus:ring-orange-500"
          }`}
          placeholder="例: 古民家を再生して地域のコミュニティスペースを作りたい"
          aria-invalid={errors.projectTitle ? "true" : "false"}
          aria-describedby={errors.projectTitle ? "projectTitle-error" : undefined}
        />
        {errors.projectTitle && (
          <p id="projectTitle-error" className="mt-1 text-sm text-red-600">
            {errors.projectTitle.message}
          </p>
        )}
      </div>

      {/* プロジェクト概要 */}
      <div>
        <label htmlFor="projectSummary" className="block text-sm font-medium text-gray-700">
          プロジェクト概要 <span className="text-red-500">*</span>
        </label>
        <textarea
          id="projectSummary"
          rows={3}
          {...register("projectSummary")}
          className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 ${
            errors.projectSummary
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-gray-300 focus:border-orange-500 focus:ring-orange-500"
          }`}
          placeholder="プロジェクトの目的や内容を簡潔にお書きください"
          aria-invalid={errors.projectSummary ? "true" : "false"}
          aria-describedby={errors.projectSummary ? "projectSummary-error" : undefined}
        />
        <div className="mt-1 flex justify-between">
          {errors.projectSummary ? (
            <p id="projectSummary-error" className="text-sm text-red-600">
              {errors.projectSummary.message}
            </p>
          ) : (
            <span />
          )}
          <span className="text-xs text-gray-500">{projectSummary?.length || 0}/500</span>
        </div>
      </div>

      {/* プロジェクト説明 */}
      <div>
        <label htmlFor="projectStory" className="block text-sm font-medium text-gray-700">
          プロジェクト説明（ストーリー・想い） <span className="text-red-500">*</span>
        </label>
        <textarea
          id="projectStory"
          rows={8}
          {...register("projectStory")}
          className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 ${
            errors.projectStory
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-gray-300 focus:border-orange-500 focus:ring-orange-500"
          }`}
          placeholder="なぜこのプロジェクトを始めたいのか、どんな想いがあるのかをお聞かせください"
          aria-invalid={errors.projectStory ? "true" : "false"}
          aria-describedby={errors.projectStory ? "projectStory-error" : undefined}
        />
        <div className="mt-1 flex justify-between">
          {errors.projectStory ? (
            <p id="projectStory-error" className="text-sm text-red-600">
              {errors.projectStory.message}
            </p>
          ) : (
            <span />
          )}
          <span className="text-xs text-gray-500">{projectStory?.length || 0}/5000</span>
        </div>
      </div>

      {/* 送信ボタン */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-md bg-orange-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? "送信中..." : "応募する"}
      </button>

      <p className="text-center text-xs text-gray-500">
        送信いただいた内容は審査にのみ使用し、第三者に提供することはありません。
      </p>
    </form>
  );
}
