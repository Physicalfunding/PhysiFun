"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Category } from "@/domain/project/entities/Project";

/**
 * プロジェクト編集フォームの入力データ型
 */
interface ProjectFormData {
  title: string;
  summary: string;
  description: string;
  category: Category;
  location: string;
}

/**
 * プロジェクトデータの型（APIレスポンス形式）
 */
interface ProjectData {
  id: string;
  title: string;
  summary: string;
  description: string;
  category: Category;
  location: string;
  status: string;
}

/**
 * カテゴリの選択肢
 */
const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: "KOMINKA", label: "古民家再生" },
  { value: "RICE_FARMING", label: "米作り" },
  { value: "DIY", label: "DIY" },
  { value: "CRAFT", label: "クラフト" },
  { value: "OTHER", label: "その他" },
];

interface ProjectEditFormProps {
  project: ProjectData;
}

/**
 * ProjectEditForm コンポーネント
 * プロジェクト編集用のフォーム
 */
export function ProjectEditForm({ project }: ProjectEditFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProjectFormData>({
    defaultValues: {
      title: project.title,
      summary: project.summary,
      description: project.description,
      category: project.category,
      location: project.location,
    },
  });

  /**
   * フォーム送信処理
   */
  const onSubmit = async (data: ProjectFormData) => {
    setIsSubmitting(true);
    setServerError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        setServerError(result.error?.message || "プロジェクトの更新に失敗しました");
        return;
      }

      setSuccessMessage("プロジェクトを更新しました");
      router.refresh();
    } catch (error) {
      setServerError("通信エラーが発生しました。もう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* サーバーエラー表示 */}
      {serverError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600 text-sm">{serverError}</p>
        </div>
      )}

      {/* 成功メッセージ表示 */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-600 text-sm">{successMessage}</p>
        </div>
      )}

      {/* タイトル入力 */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
          プロジェクトタイトル <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          type="text"
          {...register("title", {
            required: "タイトルを入力してください",
            maxLength: { value: 100, message: "タイトルは100文字以内で入力してください" },
          })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
        {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
      </div>

      {/* カテゴリ選択 */}
      <div>
        <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
          カテゴリ <span className="text-red-500">*</span>
        </label>
        <select
          id="category"
          {...register("category", { required: "カテゴリを選択してください" })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        >
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>}
      </div>

      {/* 開催場所入力 */}
      <div>
        <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
          開催場所 <span className="text-red-500">*</span>
        </label>
        <input
          id="location"
          type="text"
          {...register("location", {
            required: "開催場所を入力してください",
            maxLength: { value: 100, message: "開催場所は100文字以内で入力してください" },
          })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
        {errors.location && <p className="mt-1 text-sm text-red-600">{errors.location.message}</p>}
      </div>

      {/* 概要入力 */}
      <div>
        <label htmlFor="summary" className="block text-sm font-medium text-gray-700 mb-1">
          概要 <span className="text-red-500">*</span>
        </label>
        <textarea
          id="summary"
          {...register("summary", {
            required: "概要を入力してください",
            maxLength: { value: 300, message: "概要は300文字以内で入力してください" },
          })}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
        {errors.summary && <p className="mt-1 text-sm text-red-600">{errors.summary.message}</p>}
      </div>

      {/* 詳細説明入力 */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          詳細説明 <span className="text-red-500">*</span>
        </label>
        <textarea
          id="description"
          {...register("description", {
            required: "詳細説明を入力してください",
            minLength: { value: 50, message: "詳細説明は50文字以上で入力してください" },
          })}
          rows={8}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      {/* 送信ボタン */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting || !isDirty}
          className="px-6 py-3 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 focus:ring-4 focus:ring-orange-200 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? (
            <span className="flex items-center">
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              更新中...
            </span>
          ) : (
            "変更を保存"
          )}
        </button>
      </div>
    </form>
  );
}
