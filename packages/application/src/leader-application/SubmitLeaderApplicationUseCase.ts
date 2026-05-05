import { randomBytes, randomUUID } from "node:crypto";
import {
  type Result,
  err,
  ok,
  CATEGORY_MASTER,
  LEADER_APPLICATION_LIMITS,
  LeaderApplicationRecruitmentType,
  PHONE_NUMBER_MAX_LENGTH,
  PhoneNumber,
  type PhoneNumberError,
  PROJECT_DRAFT_LIMITS,
  ProjectDraft,
  type ProjectDraftError,
  ProjectLocation,
  type ProjectLocationError,
  ProjectPhase,
  SnsLinks,
  type SnsLinksError,
} from "@physifun/domain";
import { z } from "zod";
import type { SubmitLeaderApplicationPort } from "./ports/SubmitLeaderApplicationPort";

// ==================== 入力バリデーション ====================

/**
 * ドメイン層の CATEGORY_MASTER から Zod enum 用の値配列を生成（Single Source of Truth）
 */
const PROJECT_CATEGORY_VALUES = CATEGORY_MASTER.map((c) => c.value) as [string, ...string[]];

/**
 * ProjectPhase 値配列（Zod enum 用）
 */
const PROJECT_PHASE_VALUES = Object.values(ProjectPhase) as [ProjectPhase, ...ProjectPhase[]];

/**
 * LeaderApplicationRecruitmentType 値配列（Zod enum 用）
 */
const RECRUITMENT_TYPE_VALUES = Object.values(LeaderApplicationRecruitmentType) as [
  LeaderApplicationRecruitmentType,
  ...LeaderApplicationRecruitmentType[],
];

/**
 * SNS リンクのスキーマ（各フィールド任意、最大 500 文字）
 */
const snsLinksSchema = z
  .object({
    x: z.string().max(500, "SNS URL(X) は 500 文字以内").nullish(),
    instagram: z.string().max(500, "SNS URL(Instagram) は 500 文字以内").nullish(),
    facebook: z.string().max(500, "SNS URL(Facebook) は 500 文字以内").nullish(),
    website: z.string().max(500, "SNS URL(Website) は 500 文字以内").nullish(),
  })
  .optional();

/**
 * SubmitLeaderApplication の入力スキーマ (Zod)
 *
 * 文字数上限はドメイン層の PROJECT_DRAFT_LIMITS / LEADER_APPLICATION_LIMITS を参照し、
 * Single Source of Truth を維持する。
 *
 * 条件付き必須（recruitmentTypes の選択値による分岐）は `superRefine` で実装する。
 */
export const submitLeaderApplicationInputSchema = z
  .object({
    email: z
      .string()
      .email("有効なメールアドレスを入力してください")
      // メールアドレスはケースインセンシティブで扱う必要があるため、
      // 入力段で trim + toLowerCase して正規化する。
      // 以降の重複チェック / Account.email 保存 / Outbox payload に一貫した形で伝播する。
      .transform((value) => value.trim().toLowerCase()),
    displayName: z.string().min(1, "お名前は必須です").max(50, "お名前は 50 文字以内です"),
    /**
     * 電話番号（任意、〜20 文字）
     * - Issue #192 PR3: Account.phoneNumber と LeaderApplication.phoneNumber の両方に保存する
     *   （応募スナップショット）。
     * - フォーマット検証（許可文字）はドメイン VO（PhoneNumber）で実施する。
     */
    phoneNumber: z
      .string()
      .max(PHONE_NUMBER_MAX_LENGTH, `電話番号は ${PHONE_NUMBER_MAX_LENGTH} 文字以内です`)
      .nullish(),
    projectTitle: z
      .string()
      .min(1, "プロジェクトタイトルは必須です")
      .max(
        PROJECT_DRAFT_LIMITS.projectTitle,
        `プロジェクトタイトルは ${PROJECT_DRAFT_LIMITS.projectTitle} 文字以内です`
      ),
    projectSummary: z
      .string()
      .min(1, "プロジェクト概要は必須です")
      .max(
        PROJECT_DRAFT_LIMITS.projectSummary,
        `プロジェクト概要は ${PROJECT_DRAFT_LIMITS.projectSummary} 文字以内です`
      ),
    projectStory: z
      .string()
      .min(1, "プロジェクトストーリーは必須です")
      .max(
        PROJECT_DRAFT_LIMITS.projectStory,
        `プロジェクトストーリーは ${PROJECT_DRAFT_LIMITS.projectStory} 文字以内です`
      ),
    projectCategory: z.enum(PROJECT_CATEGORY_VALUES, {
      errorMap: () => ({ message: "無効なプロジェクトカテゴリです" }),
    }),
    prefectureCode: z.string().regex(/^(?:0[1-9]|[1-3][0-9]|4[0-7])$/, {
      message: "無効な都道府県コードです",
    }),
    municipality: z.string().max(50, "市区町村は 50 文字以内です").nullish(),
    snsLinks: snsLinksSchema,

    // 応募フォーム拡張 (Issue #192 PR3)
    /** プロジェクトの進捗（必須） */
    progress: z.enum(PROJECT_PHASE_VALUES, {
      errorMap: () => ({ message: "進捗フェーズを選択してください" }),
    }),
    /** 募集タイプ（1 件以上必須） */
    recruitmentTypes: z
      .array(
        z.enum(RECRUITMENT_TYPE_VALUES, {
          errorMap: () => ({ message: "無効な募集タイプです" }),
        })
      )
      .min(1, "募集内容を 1 件以上選択してください"),

    /**
     * 体験できること（必須・〜150）
     *
     * 半角スペースのみの入力を必須バリデーションで弾くため、まず trim してから
     * min(1) / max(...) を適用する（PR #195 review M1 対応）。
     */
    experienceOffered: z
      .string()
      .transform((v) => v.trim())
      .pipe(
        z
          .string()
          .min(1, "体験できることは必須です")
          .max(
            LEADER_APPLICATION_LIMITS.experienceOffered,
            `体験できることは ${LEADER_APPLICATION_LIMITS.experienceOffered} 文字以内です`
          )
      ),

    // TIME 募集枠（条件付き必須は superRefine で担保）
    /** 活動内容（TIME 必須・〜200） */
    activityContent: z
      .string()
      .max(
        PROJECT_DRAFT_LIMITS.activityContent,
        `活動内容は ${PROJECT_DRAFT_LIMITS.activityContent} 文字以内です`
      )
      .nullish(),
    /** 開催場所（TIME 必須） */
    eventLocation: z
      .string()
      .max(
        LEADER_APPLICATION_LIMITS.eventLocation,
        `開催場所は ${LEADER_APPLICATION_LIMITS.eventLocation} 文字以内です`
      )
      .nullish(),
    /** 実施期間（TIME 必須） */
    eventPeriod: z
      .string()
      .max(
        LEADER_APPLICATION_LIMITS.eventPeriod,
        `実施期間は ${LEADER_APPLICATION_LIMITS.eventPeriod} 文字以内です`
      )
      .nullish(),
    /** 募集人数（TIME 必須・>= 1） */
    recruitCount: z
      .number()
      .int("募集人数は整数で入力してください")
      .min(1, "募集人数は 1 以上です")
      .nullish(),
    /** 時間用リターン（TIME 必須・〜200） */
    timeReturn: z
      .string()
      .max(
        LEADER_APPLICATION_LIMITS.timeReturn,
        `時間用リターンは ${LEADER_APPLICATION_LIMITS.timeReturn} 文字以内です`
      )
      .nullish(),

    // SKILL_ITEM 募集枠（条件付き必須は superRefine で担保）
    /** 募集したい内容（SKILL_ITEM 必須） */
    skillItemNeeds: z
      .string()
      .max(
        LEADER_APPLICATION_LIMITS.skillItemNeeds,
        `募集したい内容は ${LEADER_APPLICATION_LIMITS.skillItemNeeds} 文字以内です`
      )
      .nullish(),
    /** 期限（SKILL_ITEM 必須） */
    skillItemDeadline: z
      .string()
      .max(
        LEADER_APPLICATION_LIMITS.skillItemDeadline,
        `期限は ${LEADER_APPLICATION_LIMITS.skillItemDeadline} 文字以内です`
      )
      .nullish(),
    /** スキル・モノ用リターン（SKILL_ITEM 必須） */
    skillItemReturn: z
      .string()
      .max(
        LEADER_APPLICATION_LIMITS.skillItemReturn,
        `スキル・モノ用リターンは ${LEADER_APPLICATION_LIMITS.skillItemReturn} 文字以内です`
      )
      .nullish(),

    /** リクエスト元の IP アドレス（レートリミット用） */
    ipAddress: z.string().min(1, "IP アドレスは必須です"),
    /** CAPTCHA トークン */
    captchaToken: z.string().min(1, "CAPTCHA トークンは必須です"),
  })
  .superRefine((data, ctx) => {
    // 条件付き必須: recruitmentTypes に TIME を含む場合
    const hasTime = data.recruitmentTypes.includes(LeaderApplicationRecruitmentType.TIME);
    if (hasTime) {
      const timeRequired: Array<{
        field: keyof typeof data;
        message: string;
      }> = [
        { field: "activityContent", message: "活動内容は必須です（時間募集を選択時）" },
        { field: "eventLocation", message: "開催場所は必須です（時間募集を選択時）" },
        { field: "eventPeriod", message: "実施期間は必須です（時間募集を選択時）" },
        { field: "timeReturn", message: "時間用リターンは必須です（時間募集を選択時）" },
      ];
      for (const { field, message } of timeRequired) {
        const value = data[field];
        if (
          value === null ||
          value === undefined ||
          (typeof value === "string" && value.trim() === "")
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field as string],
            message,
          });
        }
      }
      if (data.recruitCount === null || data.recruitCount === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recruitCount"],
          message: "募集人数は必須です（時間募集を選択時）",
        });
      }
    }

    // 条件付き必須: recruitmentTypes に SKILL_ITEM を含む場合
    const hasSkillItem = data.recruitmentTypes.includes(
      LeaderApplicationRecruitmentType.SKILL_ITEM
    );
    if (hasSkillItem) {
      const skillRequired: Array<{
        field: keyof typeof data;
        message: string;
      }> = [
        {
          field: "skillItemNeeds",
          message: "募集したい内容は必須です（スキル・モノ募集を選択時）",
        },
        { field: "skillItemDeadline", message: "期限は必須です（スキル・モノ募集を選択時）" },
        {
          field: "skillItemReturn",
          message: "スキル・モノ用リターンは必須です（スキル・モノ募集を選択時）",
        },
      ];
      for (const { field, message } of skillRequired) {
        const value = data[field];
        if (
          value === null ||
          value === undefined ||
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

/**
 * ユースケースの入力 DTO 型
 */
export type SubmitLeaderApplicationInput = z.infer<typeof submitLeaderApplicationInputSchema>;

// ==================== 出力 DTO ====================

/**
 * 成功時の出力 DTO
 */
export interface SubmitLeaderApplicationOutput {
  readonly applicationId: string;
  readonly accountId: string;
}

// ==================== エラー型 ====================

/**
 * ユースケースのエラー型（判別共用体）
 */
export type SubmitLeaderApplicationError =
  | {
      readonly type: "VALIDATION_ERROR";
      readonly issues: Array<{ path: string; message: string }>;
    }
  | { readonly type: "RATE_LIMIT_EXCEEDED" }
  | { readonly type: "CAPTCHA_VERIFICATION_FAILED" }
  | {
      readonly type: "DUPLICATE_PENDING_APPLICATION";
      readonly email: string;
    };

// ==================== スタブ関数 ====================

/**
 * IP レートリミットチェック (B-6: 1 時間あたり同一 IP から最大 3 件)
 *
 * TODO: 実際のレートリミットロジックを実装する（Redis / DB ベースのカウンター）
 *
 * @param _ipAddress - リクエスト元 IP
 * @returns 常に ok を返す（スタブ実装）
 */
function checkIpRateLimit(_ipAddress: string): Result<void, { type: "RATE_LIMIT_EXCEEDED" }> {
  // スタブ: 常に OK
  return ok(undefined);
}

/**
 * CAPTCHA 検証 (A-3)
 *
 * TODO: reCAPTCHA / hCaptcha / Turnstile 等の実際の検証ロジックを実装する
 *
 * @param _token - CAPTCHA トークン
 * @returns 常に ok を返す（スタブ実装）
 */
function verifyCaptcha(_token: string): Result<void, { type: "CAPTCHA_VERIFICATION_FAILED" }> {
  // スタブ: 常に OK
  return ok(undefined);
}

// ==================== アクティベーショントークン ====================

/**
 * アクティベーショントークンの有効期限（24 時間）
 */
const ACTIVATION_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * アクティベーショントークンを生成する（32 バイトのランダム 16 進文字列）
 */
function generateActivationToken(): string {
  return randomBytes(32).toString("hex");
}

// ==================== ドメインエラー → VALIDATION_ERROR 変換 ====================

type DomainVoError = ProjectLocationError | SnsLinksError | ProjectDraftError | PhoneNumberError;

/**
 * ドメイン VO のエラーを VALIDATION_ERROR の issues 形式に変換する
 */
function mapDomainErrorToIssue(error: DomainVoError): { path: string; message: string } {
  switch (error.type) {
    case "INVALID_PREFECTURE_CODE":
      return { path: "prefectureCode", message: "無効な都道府県コードです" };
    case "MUNICIPALITY_TOO_LONG":
      return { path: "municipality", message: `市区町村は ${error.maxLength} 文字以内です` };
    case "SNS_URL_TOO_LONG":
      return {
        path: `snsLinks.${error.field}`,
        message: `SNS URL は ${error.maxLength} 文字以内です`,
      };
    case "INVALID_URL_SCHEME":
      return {
        path: `snsLinks.${error.field}`,
        message: `SNS URL は ${error.allowedSchemes.join(" または ")} で始まる URL を指定してください`,
      };
    case "REQUIRED_TEXT_EMPTY":
      return { path: error.field, message: `${error.field} は必須です` };
    case "TEXT_TOO_LONG":
      return { path: error.field, message: `${error.field} は ${error.maxLength} 文字以内です` };
    case "INVALID_PROJECT_CATEGORY":
      return { path: "projectCategory", message: "無効なプロジェクトカテゴリです" };
    case "PHONE_NUMBER_TOO_LONG":
      return { path: "phoneNumber", message: `電話番号は ${error.maxLength} 文字以内です` };
    case "PHONE_NUMBER_INVALID_CHARACTERS":
      return {
        path: "phoneNumber",
        message: "電話番号は数字・ハイフン・プラス・括弧・半角スペースのみで入力してください",
      };
    default: {
      // 将来 DomainVoError 配下の VO エラーに variant が追加された場合に
      // コンパイルエラーで気づけるようにする
      const _exhaustive: never = error;
      throw new Error(`Unknown DomainVoError variant: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/**
 * 入力文字列を正規化（trim 後、空文字なら null）
 */
function normalizeOptional(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

// ==================== ユースケース ====================

/**
 * リーダー応募を送信するユースケース
 *
 * 1. 入力バリデーション（Zod）
 * 2. IP レートリミットチェック（スタブ）
 * 3. CAPTCHA 検証（スタブ）
 * 4. ドメイン VO 構築（ProjectLocation / SnsLinks / ProjectDraft）
 * 5. 重複チェック（同一メールで PENDING / PENDING_EMAIL_CONFIRMATION のアカウントが存在しないか）
 * 6. Account 作成（PENDING_EMAIL_CONFIRMATION, roles: [SUPPORTER]）
 * 7. LeaderApplication 作成（PENDING）
 * 8. OutboxMessage 作成（ACTIVATION_EMAIL）
 * 9. 上記 6〜8 をトランザクションで実行
 */
export class SubmitLeaderApplicationUseCase {
  constructor(private readonly port: SubmitLeaderApplicationPort) {}

  async execute(
    input: unknown
  ): Promise<Result<SubmitLeaderApplicationOutput, SubmitLeaderApplicationError>> {
    // 1. 入力バリデーション（Zod: 基本的な型・形式チェック + 条件付き必須）
    const parseResult = submitLeaderApplicationInputSchema.safeParse(input);
    if (!parseResult.success) {
      return err({
        type: "VALIDATION_ERROR",
        issues: parseResult.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    const validated = parseResult.data;

    // 2. IP レートリミットチェック
    const rateLimitResult = checkIpRateLimit(validated.ipAddress);
    if (!rateLimitResult.ok) {
      return err({ type: "RATE_LIMIT_EXCEEDED" });
    }

    // 3. CAPTCHA 検証
    const captchaResult = verifyCaptcha(validated.captchaToken);
    if (!captchaResult.ok) {
      return err({ type: "CAPTCHA_VERIFICATION_FAILED" });
    }

    // 4. ドメイン VO 構築（ドメイン層のバリデーションを通す）
    const locationResult = ProjectLocation.create({
      prefectureCode: validated.prefectureCode,
      municipality: validated.municipality ?? null,
    });
    if (!locationResult.ok) {
      return err({
        type: "VALIDATION_ERROR",
        issues: [mapDomainErrorToIssue(locationResult.error)],
      });
    }

    const snsLinksResult = SnsLinks.create({
      x: validated.snsLinks?.x ?? null,
      instagram: validated.snsLinks?.instagram ?? null,
      facebook: validated.snsLinks?.facebook ?? null,
      website: validated.snsLinks?.website ?? null,
    });
    if (!snsLinksResult.ok) {
      return err({
        type: "VALIDATION_ERROR",
        issues: [mapDomainErrorToIssue(snsLinksResult.error)],
      });
    }

    const phoneNumberResult = PhoneNumber.create(validated.phoneNumber ?? null);
    if (!phoneNumberResult.ok) {
      return err({
        type: "VALIDATION_ERROR",
        issues: [mapDomainErrorToIssue(phoneNumberResult.error)],
      });
    }
    const phoneNumber = phoneNumberResult.value;

    const draftResult = ProjectDraft.create({
      projectTitle: validated.projectTitle,
      projectSummary: validated.projectSummary,
      projectStory: validated.projectStory,
      projectCategory: validated.projectCategory,
      location: locationResult.value,
      activityContent: validated.activityContent ?? null,
      snsLinks: snsLinksResult.value,
    });
    if (!draftResult.ok) {
      return err({
        type: "VALIDATION_ERROR",
        issues: [mapDomainErrorToIssue(draftResult.error)],
      });
    }

    const draft = draftResult.value;
    const location = locationResult.value;
    const snsLinks = snsLinksResult.value;

    // 5. 重複チェック
    const existingAccount = await this.port.findAccountByEmail(validated.email);
    if (
      existingAccount &&
      (existingAccount.status === "PENDING_EMAIL_CONFIRMATION" ||
        existingAccount.status === "ACTIVE")
    ) {
      return err({
        type: "DUPLICATE_PENDING_APPLICATION",
        email: validated.email,
      });
    }

    // 6〜9. ID 生成 → トランザクション実行
    const accountId = randomUUID();
    const applicationId = randomUUID();
    const outboxMessageId = randomUUID();
    const activationToken = generateActivationToken();
    const now = new Date();
    const activationTokenExp = new Date(now.getTime() + ACTIVATION_TOKEN_EXPIRY_MS);

    const phoneNumberStr = phoneNumber ? phoneNumber.toString() : null;

    await this.port.executeInTransaction({
      account: {
        id: accountId,
        email: validated.email,
        displayName: validated.displayName.trim(),
        phoneNumber: phoneNumberStr,
        status: "PENDING_EMAIL_CONFIRMATION",
        roles: ["SUPPORTER"],
        activationToken,
        activationTokenExp,
      },
      leaderApplication: {
        id: applicationId,
        accountId,
        status: "PENDING",
        projectTitle: draft.projectTitle,
        projectSummary: draft.projectSummary,
        projectStory: draft.projectStory,
        projectCategory: draft.projectCategory,
        prefectureCode: location.prefectureCode,
        municipality: location.municipality,
        activityContent: draft.activityContent,
        snsLinks: snsLinks.isEmpty()
          ? null
          : {
              x: snsLinks.x,
              instagram: snsLinks.instagram,
              facebook: snsLinks.facebook,
              website: snsLinks.website,
            },
        phoneNumber: phoneNumberStr,
        progress: validated.progress,
        recruitmentTypes: validated.recruitmentTypes,
        eventLocation: normalizeOptional(validated.eventLocation),
        eventPeriod: normalizeOptional(validated.eventPeriod),
        recruitCount: validated.recruitCount ?? null,
        skillItemNeeds: normalizeOptional(validated.skillItemNeeds),
        skillItemDeadline: normalizeOptional(validated.skillItemDeadline),
        timeReturn: normalizeOptional(validated.timeReturn),
        skillItemReturn: normalizeOptional(validated.skillItemReturn),
        // experienceOffered は Zod 側で trim + min(1) 済みのため、そのまま渡す
        experienceOffered: validated.experienceOffered,
        submittedAt: now,
      },
      outboxMessage: {
        id: outboxMessageId,
        type: "ACTIVATION_EMAIL",
        payload: {
          accountId,
          email: validated.email,
          activationToken,
          displayName: validated.displayName.trim(),
        },
      },
    });

    return ok({ applicationId, accountId });
  }
}
