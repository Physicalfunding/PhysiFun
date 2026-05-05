"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/components/common/Toast";
import { PREFECTURES } from "@/lib/prefectures";
import {
  CATEGORY_MASTER,
  LEADER_APPLICATION_LIMITS,
  LeaderApplicationRecruitmentType,
  PHONE_NUMBER_ALLOWED_CHARS_PATTERN,
  PHONE_NUMBER_MAX_LENGTH,
  PROJECT_DRAFT_LIMITS,
  PROJECT_PHASE_LABELS,
  PROJECT_PHASE_VALUES,
  ProjectPhase,
  RECRUITMENT_TYPE_VALUES,
} from "@physifun/domain";

/**
 * API エラーレスポンスの想定形（最小定義）
 *
 * サーバー側は `{ error: { message, code, ... } }` 形式で返すため、
 * `result.error?.message` 参照に型を付けるためだけの最小型。
 */
type ApiErrorResponse = { error?: { message?: string } };

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

/**
 * フォーム入力用 Zod スキーマ
 *
 * Issue #192 PR4: 応募フォーム拡張に対応する 8 セクション構造に再編。
 * サーバー側 `submitLeaderApplicationInputSchema` と整合する。
 * 条件付き必須は `superRefine` で担保（recruitmentTypes の選択値による分岐）。
 */
export const applyFormSchema = z
  .object({
    // 1. 基本情報
    displayName: z.string().min(1, "お名前を入力してください").max(50, "お名前は 50 文字以内です"),
    phoneNumber: z
      .string()
      .max(PHONE_NUMBER_MAX_LENGTH, `電話番号は ${PHONE_NUMBER_MAX_LENGTH} 文字以内です`)
      .refine(
        (v) => v === "" || PHONE_NUMBER_ALLOWED_CHARS_PATTERN.test(v),
        "電話番号は数字・ハイフン・プラス・括弧・半角スペースのみで入力してください"
      )
      .optional(),
    email: z
      .string()
      .min(1, "メールアドレスを入力してください")
      .email("無効なメールアドレス形式です"),

    // 2. プロジェクト詳細
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
      .min(1, "プロジェクト説明（想い）を入力してください")
      .max(
        PROJECT_DRAFT_LIMITS.projectStory,
        `プロジェクト説明（想い）は ${PROJECT_DRAFT_LIMITS.projectStory} 文字以内です`
      ),
    projectCategory: z.string().min(1, "プロジェクトカテゴリを選択してください"),

    // 3. プロジェクトの進捗
    progress: z.enum(PROJECT_PHASE_VALUES, {
      errorMap: () => ({ message: "進捗を選択してください" }),
    }),

    // 4. 募集内容
    recruitmentTypes: z
      .array(
        z.enum(RECRUITMENT_TYPE_VALUES, {
          errorMap: () => ({ message: "無効な募集タイプです" }),
        })
      )
      .min(1, "募集内容を 1 件以上選択してください"),

    // 4-a. 時間（やる気）募集枠（条件付き必須）
    activityContent: z
      .string()
      .max(
        PROJECT_DRAFT_LIMITS.activityContent,
        `活動内容は ${PROJECT_DRAFT_LIMITS.activityContent} 文字以内です`
      )
      .optional(),
    eventLocation: z
      .string()
      .max(
        LEADER_APPLICATION_LIMITS.eventLocation,
        `開催場所は ${LEADER_APPLICATION_LIMITS.eventLocation} 文字以内です`
      )
      .optional(),
    eventPeriod: z
      .string()
      .max(
        LEADER_APPLICATION_LIMITS.eventPeriod,
        `実施期間は ${LEADER_APPLICATION_LIMITS.eventPeriod} 文字以内です`
      )
      .optional(),
    /**
     * 募集人数（TIME 必須）
     *
     * `react-hook-form` の `register("recruitCount", { valueAsNumber: true })` で
     * number 化しているため、ここでは number として受け取る。未入力は NaN になるので
     * `nan().or(...)` ではなく `unknown` を経由して superRefine 側で判定する。
     * 上限はサーバー側と整合させるため `LEADER_APPLICATION_LIMITS.recruitCountMax` を利用。
     */
    recruitCount: z
      .union([
        z
          .number()
          .int()
          .min(1)
          .max(
            LEADER_APPLICATION_LIMITS.recruitCountMax,
            `募集人数は ${LEADER_APPLICATION_LIMITS.recruitCountMax} 以下で入力してください`
          ),
        z.nan(),
      ])
      .optional(),

    // 4-b. スキル・モノ募集枠（条件付き必須）
    skillItemNeeds: z
      .string()
      .max(
        LEADER_APPLICATION_LIMITS.skillItemNeeds,
        `募集したい内容は ${LEADER_APPLICATION_LIMITS.skillItemNeeds} 文字以内です`
      )
      .optional(),
    skillItemDeadline: z
      .string()
      .max(
        LEADER_APPLICATION_LIMITS.skillItemDeadline,
        `期限は ${LEADER_APPLICATION_LIMITS.skillItemDeadline} 文字以内です`
      )
      .optional(),

    // 5. リターン
    /**
     * 体験できること（必須）
     *
     * 半角スペースのみの入力を必須バリデーションで弾くため、サーバー側スキーマと同じく
     * trim してから min(1) / max(...) を適用する。
     */
    experienceOffered: z
      .string()
      .transform((v) => v.trim())
      .pipe(
        z
          .string()
          .min(1, "体験できることを入力してください")
          .max(
            LEADER_APPLICATION_LIMITS.experienceOffered,
            `体験できることは ${LEADER_APPLICATION_LIMITS.experienceOffered} 文字以内です`
          )
      ),
    timeReturn: z
      .string()
      .max(
        LEADER_APPLICATION_LIMITS.timeReturn,
        `時間用リターンは ${LEADER_APPLICATION_LIMITS.timeReturn} 文字以内です`
      )
      .optional(),
    skillItemReturn: z
      .string()
      .max(
        LEADER_APPLICATION_LIMITS.skillItemReturn,
        `スキル・モノ用リターンは ${LEADER_APPLICATION_LIMITS.skillItemReturn} 文字以内です`
      )
      .optional(),

    // 6. 活動場所
    prefectureCode: z.string().min(1, "都道府県を選択してください"),
    municipality: z.string().max(50, "市区町村は 50 文字以内です").optional(),

    // 7. SNS リンク
    snsLinks: z
      .object({
        x: snsUrlField("X"),
        instagram: snsUrlField("Instagram"),
        facebook: snsUrlField("Facebook"),
        website: snsUrlField("Website"),
      })
      .optional(),

    // 8. 利用規約同意
    agreeTerms: z.literal(true, {
      errorMap: () => ({ message: "利用規約に同意してください" }),
    }),
  })
  .superRefine((data, ctx) => {
    const hasTime = data.recruitmentTypes.includes(LeaderApplicationRecruitmentType.TIME);
    if (hasTime) {
      const required: Array<{ field: keyof typeof data; message: string }> = [
        { field: "activityContent", message: "活動内容を入力してください" },
        { field: "eventLocation", message: "開催場所を入力してください" },
        { field: "eventPeriod", message: "実施期間を入力してください" },
        { field: "timeReturn", message: "時間用リターンを入力してください" },
      ];
      for (const { field, message } of required) {
        const value = data[field];
        if (
          value === undefined ||
          value === null ||
          (typeof value === "string" && value.trim() === "")
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field as string],
            message,
          });
        }
      }
      if (
        data.recruitCount === undefined ||
        data.recruitCount === null ||
        Number.isNaN(data.recruitCount)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recruitCount"],
          message: "募集人数を入力してください",
        });
      }
    }

    const hasSkillItem = data.recruitmentTypes.includes(
      LeaderApplicationRecruitmentType.SKILL_ITEM
    );
    if (hasSkillItem) {
      const required: Array<{ field: keyof typeof data; message: string }> = [
        { field: "skillItemNeeds", message: "募集したい内容を入力してください" },
        { field: "skillItemDeadline", message: "期限を入力してください" },
        { field: "skillItemReturn", message: "スキル・モノ用リターンを入力してください" },
      ];
      for (const { field, message } of required) {
        const value = data[field];
        if (
          value === undefined ||
          value === null ||
          (typeof value === "string" && value.trim() === "")
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field as string],
            message,
          });
        }
      }
    }
  });

type ApplyFormData = z.infer<typeof applyFormSchema>;

// ==================== Turnstile 型定義 ====================

/**
 * Cloudflare Turnstile JS API の最小型定義 (Issue #200)
 *
 * `https://challenges.cloudflare.com/turnstile/v0/api.js` 読み込み後に
 * `window.turnstile` にぶら下がる API。
 */
interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
    }
  ): string;
  reset(widgetId?: string): void;
  remove(widgetId?: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

// ==================== ヘルパー ====================

const inputClassName = (hasError: boolean) =>
  `mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 ${
    hasError
      ? "border-red-300 focus:border-red-500 focus:ring-red-500"
      : "border-gray-300 focus:border-orange-500 focus:ring-orange-500"
  }`;

const labelClassName = "block text-sm font-medium text-gray-700";
const sectionClassName = "rounded-lg border border-gray-200 bg-white p-6 shadow-sm";
const sectionHeadingClassName = "mb-4 text-lg font-semibold text-gray-900";
const subSectionHeadingClassName = "text-base font-medium text-gray-900";

// ==================== コンポーネント ====================

/**
 * ApplyForm
 * リーダー応募フォームコンポーネント (Issue #192 PR4 で 8 セクション構造に再編)
 */
export function ApplyForm() {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const [turnstileScriptLoaded, setTurnstileScriptLoaded] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<ApplyFormData>({
    resolver: zodResolver(applyFormSchema),
    defaultValues: {
      recruitmentTypes: [],
      snsLinks: {
        x: "",
        instagram: "",
        facebook: "",
        website: "",
      },
    },
  });

  // 募集内容のチェックボックス状態を監視（条件付き表示用）
  const recruitmentTypes = useWatch({ control, name: "recruitmentTypes" }) ?? [];
  const showTimeFields = recruitmentTypes.includes(LeaderApplicationRecruitmentType.TIME);
  const showSkillItemFields = recruitmentTypes.includes(
    LeaderApplicationRecruitmentType.SKILL_ITEM
  );

  /**
   * 条件付きフィールドの値クリーンアップ
   *
   * `recruitmentTypes` のチェックを外したときに、非表示になったフィールドに
   * 入力済みの値が残ったまま送信されてしまうのを防ぐため、該当フィールドを
   * `undefined` にリセットする。`shouldUnregister: true` をフォーム全体に適用すると
   * 動的セクションの値も意図せず消える副作用があるため、useEffect 方式を採用。
   */
  useEffect(() => {
    if (!showTimeFields) {
      setValue("activityContent", undefined);
      setValue("eventLocation", undefined);
      setValue("eventPeriod", undefined);
      setValue("recruitCount", undefined);
      setValue("timeReturn", undefined);
    }
  }, [showTimeFields, setValue]);

  useEffect(() => {
    if (!showSkillItemFields) {
      setValue("skillItemNeeds", undefined);
      setValue("skillItemDeadline", undefined);
      setValue("skillItemReturn", undefined);
    }
  }, [showSkillItemFields, setValue]);

  /**
   * Turnstile widget の描画 (Issue #200)
   *
   * - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` 未設定の場合は描画をスキップして CAPTCHA を要求しない
   *   （ローカル開発の fail-open 動作と整合させるため）。
   * - スクリプト読み込み後 `window.turnstile.render` で明示的に描画し、callback で
   *   トークンを React state に格納する。
   * - Strict Mode の二重マウント / アンマウント時に widget をクリーンアップして
   *   `[Cloudflare Turnstile] A widget with the same id already exists` を回避する。
   */
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    if (!turnstileScriptLoaded) return;
    if (!turnstileContainerRef.current) return;
    if (typeof window === "undefined" || !window.turnstile) return;

    const widgetId = window.turnstile.render(turnstileContainerRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token: string) => setCaptchaToken(token),
      "expired-callback": () => setCaptchaToken(null),
      "error-callback": () => setCaptchaToken(null),
      theme: "light",
    });
    turnstileWidgetIdRef.current = widgetId;

    return () => {
      if (window.turnstile && turnstileWidgetIdRef.current) {
        window.turnstile.remove(turnstileWidgetIdRef.current);
        turnstileWidgetIdRef.current = null;
      }
    };
  }, [turnstileScriptLoaded]);

  const onSubmit = async (data: ApplyFormData) => {
    // CAPTCHA 必須環境（site key 設定済み）でトークン未取得なら送信させない
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      showToast("CAPTCHA を完了してから送信してください", "error");
      return;
    }

    setIsLoading(true);

    try {
      // agreeTerms はフロント専用なので送信データから除外
      const { agreeTerms: _, ...submitData } = data;

      const response = await fetch("/api/leader-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...submitData,
          // site key 未設定の dev 環境では captchaToken を空文字で送ると Zod の
          // `min(1)` で弾かれるため "dev-bypass" を入れる。サーバー側は
          // TURNSTILE_SECRET_KEY 未設定時に検証をパスする fail-open 動作と整合する。
          captchaToken: captchaToken ?? "dev-bypass",
        }),
      });

      if (!response.ok) {
        // 失敗時は JSON が返らない（HTML エラーページ等）可能性もあるため try/catch で守る
        let message = "応募の送信に失敗しました";
        try {
          const errorJson = (await response.json()) as ApiErrorResponse;
          if (errorJson.error?.message) {
            message = errorJson.error.message;
          }
        } catch {
          // SyntaxError 等は握りつぶしてデフォルトメッセージを使う
        }
        showToast(message, "error");
        // CAPTCHA 失敗・レート制限などサーバー側で弾かれた場合は token を破棄して
        // 再チャレンジできるようにする
        if (TURNSTILE_SITE_KEY && window.turnstile && turnstileWidgetIdRef.current) {
          window.turnstile.reset(turnstileWidgetIdRef.current);
          setCaptchaToken(null);
        }
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
      {/* 1. 基本情報 */}
      <section className={sectionClassName}>
        <h2 className={sectionHeadingClassName}>1. 基本情報</h2>
        <div className="space-y-4">
          {/* お名前 */}
          <div>
            <label htmlFor="displayName" className={labelClassName}>
              お名前 <span className="text-red-500">*</span>
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

          {/* 電話番号 (任意) */}
          <div>
            <label htmlFor="phoneNumber" className={labelClassName}>
              電話番号
            </label>
            <input
              id="phoneNumber"
              type="tel"
              autoComplete="tel"
              placeholder="090-1234-5678"
              {...register("phoneNumber")}
              className={inputClassName(!!errors.phoneNumber)}
              aria-invalid={errors.phoneNumber ? "true" : "false"}
            />
            <p className="mt-1 text-xs text-gray-500">
              ハイフンや国際表記（+81）も入力できます。最大 {PHONE_NUMBER_MAX_LENGTH} 文字
            </p>
            {errors.phoneNumber && (
              <p className="mt-1 text-sm text-red-600">{errors.phoneNumber.message}</p>
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
      </section>

      {/* 2. プロジェクト詳細 */}
      <section className={sectionClassName}>
        <h2 className={sectionHeadingClassName}>2. プロジェクト詳細</h2>
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
            <p className="mt-1 text-xs text-gray-500">
              推奨 50〜60 文字。最大 {PROJECT_DRAFT_LIMITS.projectTitle} 文字
            </p>
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

          {/* プロジェクト説明（想い） */}
          <div>
            <label htmlFor="projectStory" className={labelClassName}>
              プロジェクト説明（想い） <span className="text-red-500">*</span>
            </label>
            <textarea
              id="projectStory"
              rows={6}
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
      </section>

      {/* 3. プロジェクトの進捗 */}
      <section className={sectionClassName}>
        <fieldset>
          <legend className={sectionHeadingClassName}>3. プロジェクトの進捗</legend>
          <p className="mb-3 text-sm text-gray-600">
            現在のプロジェクトの進行状況を 1 つ選んでください。
            <span className="text-red-500">*</span>
          </p>
          <div className="space-y-2">
            {Object.values(ProjectPhase).map((phase) => (
              <div key={phase} className="flex items-center gap-2">
                <input
                  id={`progress-${phase}`}
                  type="radio"
                  value={phase}
                  {...register("progress")}
                  className="h-4 w-4 border-gray-300 text-orange-600 focus:ring-orange-500"
                />
                <label htmlFor={`progress-${phase}`} className="text-sm text-gray-700">
                  {PROJECT_PHASE_LABELS[phase]}
                </label>
              </div>
            ))}
          </div>
          {errors.progress && (
            <p className="mt-2 text-sm text-red-600">{errors.progress.message}</p>
          )}
        </fieldset>
      </section>

      {/* 4. 募集内容 */}
      <section className={sectionClassName}>
        <h2 className={sectionHeadingClassName} id="recruitmentTypes-heading">
          4. 募集内容
        </h2>
        <div role="group" aria-labelledby="recruitmentTypes-heading">
          <p className="mb-3 text-sm text-gray-600">
            募集する支援の種類を 1 つ以上選んでください（複数可）。
            <span className="text-red-500">*</span>
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                id="recruitmentType-time"
                type="checkbox"
                value={LeaderApplicationRecruitmentType.TIME}
                {...register("recruitmentTypes")}
                className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              />
              <label htmlFor="recruitmentType-time" className="text-sm text-gray-700">
                時間（やる気）での支援を募集する
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="recruitmentType-skill-item"
                type="checkbox"
                value={LeaderApplicationRecruitmentType.SKILL_ITEM}
                {...register("recruitmentTypes")}
                className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              />
              <label htmlFor="recruitmentType-skill-item" className="text-sm text-gray-700">
                スキル・モノでの支援を募集する
              </label>
            </div>
          </div>
          {errors.recruitmentTypes && (
            <p className="mt-2 text-sm text-red-600">{errors.recruitmentTypes.message}</p>
          )}
        </div>

        {/* 4-a. 時間（やる気）枠 */}
        {showTimeFields && (
          <div className="mt-6 space-y-4 border-l-4 border-orange-200 pl-4">
            <h3 className={subSectionHeadingClassName}>時間（やる気）募集の詳細</h3>

            <div>
              <label htmlFor="activityContent" className={labelClassName}>
                活動内容 <span className="text-red-500">*</span>
              </label>
              <textarea
                id="activityContent"
                rows={3}
                {...register("activityContent")}
                className={inputClassName(!!errors.activityContent)}
                aria-invalid={errors.activityContent ? "true" : "false"}
              />
              {/*
                activityContent の上限は ProjectDraft VO 由来の `PROJECT_DRAFT_LIMITS.activityContent`
                を参照する（ドメイン側で同名フィールドを既に保持しているため SSOT を維持する）。
                以下の eventLocation / eventPeriod など PR3 で新規追加されたフィールドだけが
                `LEADER_APPLICATION_LIMITS` 側に定義されているため、ここは混在となるが意図的。
              */}
              <p className="mt-1 text-xs text-gray-500">
                最大 {PROJECT_DRAFT_LIMITS.activityContent} 文字
              </p>
              {errors.activityContent && (
                <p className="mt-1 text-sm text-red-600">{errors.activityContent.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="eventLocation" className={labelClassName}>
                開催場所 <span className="text-red-500">*</span>
              </label>
              <input
                id="eventLocation"
                type="text"
                {...register("eventLocation")}
                className={inputClassName(!!errors.eventLocation)}
                aria-invalid={errors.eventLocation ? "true" : "false"}
              />
              {errors.eventLocation && (
                <p className="mt-1 text-sm text-red-600">{errors.eventLocation.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="eventPeriod" className={labelClassName}>
                実施期間 <span className="text-red-500">*</span>
              </label>
              <input
                id="eventPeriod"
                type="text"
                placeholder="例: 2026年6月〜10月"
                {...register("eventPeriod")}
                className={inputClassName(!!errors.eventPeriod)}
                aria-invalid={errors.eventPeriod ? "true" : "false"}
              />
              {errors.eventPeriod && (
                <p className="mt-1 text-sm text-red-600">{errors.eventPeriod.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="recruitCount" className={labelClassName}>
                募集人数 <span className="text-red-500">*</span>
              </label>
              <input
                id="recruitCount"
                type="number"
                min={1}
                max={LEADER_APPLICATION_LIMITS.recruitCountMax}
                step={1}
                {...register("recruitCount", { valueAsNumber: true })}
                className={inputClassName(!!errors.recruitCount)}
                aria-invalid={errors.recruitCount ? "true" : "false"}
              />
              {errors.recruitCount && (
                <p className="mt-1 text-sm text-red-600">{errors.recruitCount.message}</p>
              )}
            </div>
          </div>
        )}

        {/* 4-b. スキル・モノ枠 */}
        {showSkillItemFields && (
          <div className="mt-6 space-y-4 border-l-4 border-orange-200 pl-4">
            <h3 className={subSectionHeadingClassName}>スキル・モノ募集の詳細</h3>

            <div>
              <label htmlFor="skillItemNeeds" className={labelClassName}>
                募集したい内容 <span className="text-red-500">*</span>
              </label>
              <textarea
                id="skillItemNeeds"
                rows={3}
                {...register("skillItemNeeds")}
                className={inputClassName(!!errors.skillItemNeeds)}
                aria-invalid={errors.skillItemNeeds ? "true" : "false"}
              />
              <p className="mt-1 text-xs text-gray-500">
                最大 {LEADER_APPLICATION_LIMITS.skillItemNeeds} 文字
              </p>
              {errors.skillItemNeeds && (
                <p className="mt-1 text-sm text-red-600">{errors.skillItemNeeds.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="skillItemDeadline" className={labelClassName}>
                期限 <span className="text-red-500">*</span>
              </label>
              <input
                id="skillItemDeadline"
                type="text"
                placeholder="例: 2026年7月末まで"
                {...register("skillItemDeadline")}
                className={inputClassName(!!errors.skillItemDeadline)}
                aria-invalid={errors.skillItemDeadline ? "true" : "false"}
              />
              {errors.skillItemDeadline && (
                <p className="mt-1 text-sm text-red-600">{errors.skillItemDeadline.message}</p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 5. リターン */}
      <section className={sectionClassName}>
        <h2 className={sectionHeadingClassName}>5. リターン</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="experienceOffered" className={labelClassName}>
              体験できること <span className="text-red-500">*</span>
            </label>
            <textarea
              id="experienceOffered"
              rows={3}
              {...register("experienceOffered")}
              className={inputClassName(!!errors.experienceOffered)}
              aria-invalid={errors.experienceOffered ? "true" : "false"}
            />
            <p className="mt-1 text-xs text-gray-500">
              支援者が応募・参加することで体験できることを記載してください。最大{" "}
              {LEADER_APPLICATION_LIMITS.experienceOffered} 文字
            </p>
            {errors.experienceOffered && (
              <p className="mt-1 text-sm text-red-600">{errors.experienceOffered.message}</p>
            )}
          </div>

          {showTimeFields && (
            <div>
              <label htmlFor="timeReturn" className={labelClassName}>
                時間用リターン <span className="text-red-500">*</span>
              </label>
              <textarea
                id="timeReturn"
                rows={3}
                {...register("timeReturn")}
                className={inputClassName(!!errors.timeReturn)}
                aria-invalid={errors.timeReturn ? "true" : "false"}
              />
              <p className="mt-1 text-xs text-gray-500">
                時間（やる気）支援者へのリターン。最大 {LEADER_APPLICATION_LIMITS.timeReturn} 文字
              </p>
              {errors.timeReturn && (
                <p className="mt-1 text-sm text-red-600">{errors.timeReturn.message}</p>
              )}
            </div>
          )}

          {showSkillItemFields && (
            <div>
              <label htmlFor="skillItemReturn" className={labelClassName}>
                スキル・モノ用リターン <span className="text-red-500">*</span>
              </label>
              <textarea
                id="skillItemReturn"
                rows={3}
                {...register("skillItemReturn")}
                className={inputClassName(!!errors.skillItemReturn)}
                aria-invalid={errors.skillItemReturn ? "true" : "false"}
              />
              <p className="mt-1 text-xs text-gray-500">
                スキル・モノ支援者へのリターン。最大 {LEADER_APPLICATION_LIMITS.skillItemReturn}{" "}
                文字
              </p>
              {errors.skillItemReturn && (
                <p className="mt-1 text-sm text-red-600">{errors.skillItemReturn.message}</p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 6. 活動場所 */}
      <section className={sectionClassName}>
        <h2 className={sectionHeadingClassName}>6. 活動場所</h2>
        <div className="space-y-4">
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
        </div>
      </section>

      {/* 7. SNS リンク */}
      <section className={sectionClassName}>
        <h2 className={sectionHeadingClassName}>7. SNS リンク</h2>
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
      </section>

      {/* 8. 利用規約同意 */}
      <section className={sectionClassName}>
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
      </section>

      {/* CAPTCHA (Cloudflare Turnstile, Issue #200) */}
      {TURNSTILE_SITE_KEY && (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
            strategy="afterInteractive"
            onLoad={() => setTurnstileScriptLoaded(true)}
          />
          <div className="flex justify-center">
            <div ref={turnstileContainerRef} aria-label="CAPTCHA" />
          </div>
        </>
      )}

      {/* 送信ボタン */}
      <button
        type="submit"
        disabled={isLoading || (!!TURNSTILE_SITE_KEY && !captchaToken)}
        className="w-full rounded-md bg-orange-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? "送信中..." : "応募する"}
      </button>
    </form>
  );
}
