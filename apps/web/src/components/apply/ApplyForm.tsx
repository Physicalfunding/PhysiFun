"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/components/common/Toast";
import { PREFECTURES } from "@/lib/prefectures";
import { CATEGORY_MASTER, PROJECT_DRAFT_LIMITS } from "@physifun/domain";

// ==================== フロントエンド用バリデーションスキーマ ====================

/**
 * SNS URL フィールド用の Zod スキーマビルダー。
 *
 * - 任意入力 (空文字 or undefined は通す)
 * - 最大 500 文字
 * - `https://` スキームのみ許可 (XSS 対策 + Mixed Content 回避)
 *
 * ドメイン層 (`SnsLinks.create`) で同等のスキーム検証を行うが、
 * フォーム段階で弾くことでユーザー体験を損なわないようにする。
 */
function snsUrlField(label: string) {
  return z
    .string()
    .max(500, `${label} の URL は 500 文字以内です`)
    .refine(
      (v) => v === "" || /^https:\/\//i.test(v),
      `${label} は https:// で始まる URL を入力してください`
    )
    .optional();
}

const applyFormSchema = z.object({
  displayName: z.string().min(1, "表示名を入力してください").max(50, "表示名は 50 文字以内です"),
  email: z
    .string()
    .min(1, "メールアドレスを入力してください")
    .email("無効なメールアドレス形式です"),
  projectTitle: z
    .string()
    .min(1, "プロジェクトタイトルを入力してください")
    .max(
      PROJECT_DRAFT_LIMITS.projectTitle,
      `プロジェクトタイトルは ${PROJECT_DRAFT_LIMITS.projectTitle} 文字以内です`
    ),
  projectSummary: z
    .string()
    .min(1, "プロジェクト概要を入力してください")
    .max(
      PROJECT_DRAFT_LIMITS.projectSummary,
      `プロジェクト概要は ${PROJECT_DRAFT_LIMITS.projectSummary} 文字以内です`
    ),
  projectStory: z
    .string()
    .min(1, "プロジェクトストーリーを入力してください")
    .max(
      PROJECT_DRAFT_LIMITS.projectStory,
      `プロジェクトストーリーは ${PROJECT_DRAFT_LIMITS.projectStory} 文字以内です`
    ),
  projectCategory: z.string().min(1, "プロジェクトカテゴリを選択してください"),
  prefectureCode: z.string().min(1, "都道府県を選択してください"),
  municipality: z.string().max(50, "市区町村は 50 文字以内です").optional(),
  plannedActivities: z
    .string()
    .min(1, "活動予定を入力してください")
    .max(
      PROJECT_DRAFT_LIMITS.plannedActivities,
      `活動予定は ${PROJECT_DRAFT_LIMITS.plannedActivities} 文字以内です`
    ),
  snsLinks: z
    .object({
      x: snsUrlField("X"),
      instagram: snsUrlField("Instagram"),
      facebook: snsUrlField("Facebook"),
      website: snsUrlField("Website"),
    })
    .optional(),
  agreeTerms: z.literal(true, {
    errorMap: () => ({ message: "利用規約に同意してください" }),
  }),
});

type ApplyFormData = z.infer<typeof applyFormSchema>;

// ==================== ヘルパー ====================

const inputClassName = (hasError: boolean) =>
  `mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 ${
    hasError
      ? "border-red-300 focus:border-red-500 focus:ring-red-500"
      : "border-gray-300 focus:border-orange-500 focus:ring-orange-500"
  }`;

const labelClassName = "block text-sm font-medium text-gray-700";

// ==================== コンポーネント ====================

/**
 * ApplyForm
 * リーダー応募フォームコンポーネント
 */
export function ApplyForm() {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ApplyFormData>({
    resolver: zodResolver(applyFormSchema),
    defaultValues: {
      snsLinks: {
        x: "",
        instagram: "",
        facebook: "",
        website: "",
      },
    },
  });

  const onSubmit = async (data: ApplyFormData) => {
    setIsLoading(true);

    try {
      // agreeTerms はフロント専用なので送信データから除外
      const { agreeTerms: _, ...submitData } = data;

      const response = await fetch("/api/leader-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...submitData,
          captchaToken: "stub", // A-3 未決: CAPTCHA スタブ
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // フィールドエラーがある場合は Toast で通知
        const message = result.error?.message || "応募の送信に失敗しました";
        showToast(message, "error");
        return;
      }

      setIsSuccess(true);
    } catch {
      showToast("通信エラーが発生しました", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // 送信成功画面
  if (isSuccess) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-8 text-center">
        <div className="mb-4 text-4xl">&#9989;</div>
        <h2 className="mb-2 text-xl font-bold text-green-800">応募を受け付けました</h2>
        <p className="text-sm text-green-700">
          ご入力いただいたメールアドレスに確認メールを送信しました。
          <br />
          24 時間以内にメール内のリンクからアクティベーションしてください。
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* 基本情報 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">基本情報</h2>
        <div className="space-y-4">
          {/* 表示名 */}
          <div>
            <label htmlFor="displayName" className={labelClassName}>
              表示名 <span className="text-red-500">*</span>
            </label>
            <input
              id="displayName"
              type="text"
              {...register("displayName")}
              className={inputClassName(!!errors.displayName)}
              aria-invalid={errors.displayName ? "true" : "false"}
            />
            {errors.displayName && (
              <p className="mt-1 text-sm text-red-600">{errors.displayName.message}</p>
            )}
          </div>

          {/* メールアドレス */}
          <div>
            <label htmlFor="email" className={labelClassName}>
              メールアドレス <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...register("email")}
              className={inputClassName(!!errors.email)}
              aria-invalid={errors.email ? "true" : "false"}
            />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
          </div>
        </div>
      </div>

      {/* プロジェクト情報 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">プロジェクト情報</h2>
        <div className="space-y-4">
          {/* プロジェクトタイトル */}
          <div>
            <label htmlFor="projectTitle" className={labelClassName}>
              プロジェクトタイトル <span className="text-red-500">*</span>
            </label>
            <input
              id="projectTitle"
              type="text"
              {...register("projectTitle")}
              className={inputClassName(!!errors.projectTitle)}
              aria-invalid={errors.projectTitle ? "true" : "false"}
            />
            {errors.projectTitle && (
              <p className="mt-1 text-sm text-red-600">{errors.projectTitle.message}</p>
            )}
          </div>

          {/* プロジェクト概要 */}
          <div>
            <label htmlFor="projectSummary" className={labelClassName}>
              プロジェクト概要 <span className="text-red-500">*</span>
            </label>
            <textarea
              id="projectSummary"
              rows={3}
              {...register("projectSummary")}
              className={inputClassName(!!errors.projectSummary)}
              aria-invalid={errors.projectSummary ? "true" : "false"}
            />
            <p className="mt-1 text-xs text-gray-500">
              最大 {PROJECT_DRAFT_LIMITS.projectSummary} 文字
            </p>
            {errors.projectSummary && (
              <p className="mt-1 text-sm text-red-600">{errors.projectSummary.message}</p>
            )}
          </div>

          {/* プロジェクトストーリー */}
          <div>
            <label htmlFor="projectStory" className={labelClassName}>
              プロジェクトストーリー <span className="text-red-500">*</span>
            </label>
            <textarea
              id="projectStory"
              rows={8}
              {...register("projectStory")}
              className={inputClassName(!!errors.projectStory)}
              aria-invalid={errors.projectStory ? "true" : "false"}
            />
            <p className="mt-1 text-xs text-gray-500">
              最大 {PROJECT_DRAFT_LIMITS.projectStory} 文字
            </p>
            {errors.projectStory && (
              <p className="mt-1 text-sm text-red-600">{errors.projectStory.message}</p>
            )}
          </div>

          {/* プロジェクトカテゴリ */}
          <div>
            <label htmlFor="projectCategory" className={labelClassName}>
              プロジェクトカテゴリ <span className="text-red-500">*</span>
            </label>
            <select
              id="projectCategory"
              {...register("projectCategory")}
              className={inputClassName(!!errors.projectCategory)}
              aria-invalid={errors.projectCategory ? "true" : "false"}
            >
              <option value="">選択してください</option>
              {CATEGORY_MASTER.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            {errors.projectCategory && (
              <p className="mt-1 text-sm text-red-600">{errors.projectCategory.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* 活動場所・予定 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">活動場所・予定</h2>
        <div className="space-y-4">
          {/* 都道府県 */}
          <div>
            <label htmlFor="prefectureCode" className={labelClassName}>
              都道府県 <span className="text-red-500">*</span>
            </label>
            <select
              id="prefectureCode"
              {...register("prefectureCode")}
              className={inputClassName(!!errors.prefectureCode)}
              aria-invalid={errors.prefectureCode ? "true" : "false"}
            >
              <option value="">選択してください</option>
              {PREFECTURES.map((pref) => (
                <option key={pref.code} value={pref.code}>
                  {pref.name}
                </option>
              ))}
            </select>
            {errors.prefectureCode && (
              <p className="mt-1 text-sm text-red-600">{errors.prefectureCode.message}</p>
            )}
          </div>

          {/* 市区町村 */}
          <div>
            <label htmlFor="municipality" className={labelClassName}>
              市区町村
            </label>
            <input
              id="municipality"
              type="text"
              {...register("municipality")}
              className={inputClassName(!!errors.municipality)}
              aria-invalid={errors.municipality ? "true" : "false"}
            />
            {errors.municipality && (
              <p className="mt-1 text-sm text-red-600">{errors.municipality.message}</p>
            )}
          </div>

          {/* 活動予定 */}
          <div>
            <label htmlFor="plannedActivities" className={labelClassName}>
              活動予定 <span className="text-red-500">*</span>
            </label>
            <textarea
              id="plannedActivities"
              rows={4}
              {...register("plannedActivities")}
              className={inputClassName(!!errors.plannedActivities)}
              aria-invalid={errors.plannedActivities ? "true" : "false"}
            />
            <p className="mt-1 text-xs text-gray-500">
              最大 {PROJECT_DRAFT_LIMITS.plannedActivities} 文字
            </p>
            {errors.plannedActivities && (
              <p className="mt-1 text-sm text-red-600">{errors.plannedActivities.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* SNS リンク */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">SNS リンク</h2>
        <p className="mb-4 text-sm text-gray-500">
          任意項目です。入力するとプロフィールに表示されます。
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="snsLinks.x" className={labelClassName}>
              X (Twitter)
            </label>
            <input
              id="snsLinks.x"
              type="text"
              placeholder="https://x.com/username"
              {...register("snsLinks.x")}
              className={inputClassName(!!errors.snsLinks?.x)}
            />
            {errors.snsLinks?.x && (
              <p className="mt-1 text-sm text-red-600">{errors.snsLinks.x.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="snsLinks.instagram" className={labelClassName}>
              Instagram
            </label>
            <input
              id="snsLinks.instagram"
              type="text"
              placeholder="https://instagram.com/username"
              {...register("snsLinks.instagram")}
              className={inputClassName(!!errors.snsLinks?.instagram)}
            />
            {errors.snsLinks?.instagram && (
              <p className="mt-1 text-sm text-red-600">{errors.snsLinks.instagram.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="snsLinks.facebook" className={labelClassName}>
              Facebook
            </label>
            <input
              id="snsLinks.facebook"
              type="text"
              placeholder="https://facebook.com/username"
              {...register("snsLinks.facebook")}
              className={inputClassName(!!errors.snsLinks?.facebook)}
            />
            {errors.snsLinks?.facebook && (
              <p className="mt-1 text-sm text-red-600">{errors.snsLinks.facebook.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="snsLinks.website" className={labelClassName}>
              ウェブサイト
            </label>
            <input
              id="snsLinks.website"
              type="text"
              placeholder="https://example.com"
              {...register("snsLinks.website")}
              className={inputClassName(!!errors.snsLinks?.website)}
            />
            {errors.snsLinks?.website && (
              <p className="mt-1 text-sm text-red-600">{errors.snsLinks.website.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* 利用規約同意 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <input
            id="agreeTerms"
            type="checkbox"
            {...register("agreeTerms")}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
          />
          <label htmlFor="agreeTerms" className="text-sm text-gray-700">
            {/* TODO: A-2 利用規約ページが決まったらリンクを設定する */}
            <span className="font-medium text-orange-600 underline">利用規約</span>
            に同意します
          </label>
        </div>
        {errors.agreeTerms && (
          <p className="mt-2 text-sm text-red-600">{errors.agreeTerms.message}</p>
        )}
      </div>

      {/* 送信ボタン */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-md bg-orange-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? "送信中..." : "応募する"}
      </button>
    </form>
  );
}
