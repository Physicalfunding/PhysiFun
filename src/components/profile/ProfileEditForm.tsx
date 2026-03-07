"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";

/**
 * プロフィール編集フォームのバリデーションスキーマ
 */
const profileEditSchema = z.object({
  name: z.string().min(1, "名前を入力してください").max(100, "名前は100文字以内で入力してください"),
  bio: z.string().max(500, "自己紹介は500文字以内で入力してください").nullable().optional(),
  userType: z.enum(["HOST", "GUEST"], {
    errorMap: () => ({ message: "ユーザータイプを選択してください" }),
  }),
});

type ProfileEditFormData = z.infer<typeof profileEditSchema>;

/**
 * プロフィールデータの型定義
 */
interface ProfileData {
  id: string;
  email: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  userType: "HOST" | "GUEST";
}

interface ProfileEditFormProps {
  initialData: ProfileData;
  onSuccess?: () => void;
}

/**
 * ProfileEditForm
 * プロフィール編集フォームコンポーネント
 *
 * 機能:
 * - 名前、自己紹介文、ユーザータイプの編集
 * - クライアントサイドバリデーション
 * - 編集成功後のフィードバック表示
 */
export function ProfileEditForm({ initialData, onSuccess }: ProfileEditFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    setError,
  } = useForm<ProfileEditFormData>({
    resolver: zodResolver(profileEditSchema),
    defaultValues: {
      name: initialData.name,
      bio: initialData.bio ?? "",
      userType: initialData.userType,
    },
  });

  /**
   * フォーム送信ハンドラ
   */
  const onSubmit = async (data: ProfileEditFormData) => {
    setIsLoading(true);
    setServerError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/users/me", {
        method: "PATCH",
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
              setError(field as keyof ProfileEditFormData, {
                message: messages[0],
              });
            }
          });
        } else {
          setServerError(result.error?.message || "更新に失敗しました");
        }
        return;
      }

      // 成功メッセージを表示
      setSuccessMessage("プロフィールを更新しました");

      // ページをリフレッシュしてセッション情報を更新
      router.refresh();

      // コールバック実行
      onSuccess?.();
    } catch {
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

      {/* 成功メッセージ表示 */}
      {successMessage && (
        <div className="rounded-md bg-green-50 p-4">
          <p className="text-sm text-green-700">{successMessage}</p>
        </div>
      )}

      {/* メールアドレス（読み取り専用） */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          メールアドレス
        </label>
        <input
          id="email"
          type="email"
          value={initialData.email}
          disabled
          className="mt-1 block w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-500"
        />
        <p className="mt-1 text-xs text-gray-500">メールアドレスは変更できません</p>
      </div>

      {/* ユーザー名 */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          表示名 <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          type="text"
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

      {/* 自己紹介 */}
      <div>
        <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
          自己紹介
        </label>
        <textarea
          id="bio"
          rows={4}
          {...register("bio")}
          placeholder="自己紹介を入力してください（500文字以内）"
          className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 ${
            errors.bio
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-gray-300 focus:border-orange-500 focus:ring-orange-500"
          }`}
          aria-invalid={errors.bio ? "true" : "false"}
          aria-describedby={errors.bio ? "bio-error" : undefined}
        />
        {errors.bio && (
          <p id="bio-error" className="mt-1 text-sm text-red-600">
            {errors.bio.message}
          </p>
        )}
      </div>

      {/* ユーザータイプ */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          利用目的 <span className="text-red-500">*</span>
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
              スキルと時間でプロジェクトを応援したい（サポーター）
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
              プロジェクトを立ち上げたい（オーナー）
            </span>
          </label>
        </div>
        {errors.userType && <p className="mt-1 text-sm text-red-600">{errors.userType.message}</p>}
      </div>

      {/* 送信ボタン */}
      <div className="flex justify-end space-x-3">
        <button
          type="submit"
          disabled={isLoading || !isDirty}
          className="rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "保存中..." : "変更を保存"}
        </button>
      </div>
    </form>
  );
}
