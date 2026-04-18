import { randomBytes, randomUUID } from "node:crypto";
import {
  type Result,
  err,
  ok,
  CATEGORY_MASTER,
  PROJECT_DRAFT_LIMITS,
  ProjectDraft,
  type ProjectDraftError,
  ProjectLocation,
  type ProjectLocationError,
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
 * 文字数上限はドメイン層の PROJECT_DRAFT_LIMITS を参照し、Single Source of Truth を維持する。
 */
export const submitLeaderApplicationInputSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  displayName: z.string().min(1, "表示名は必須です").max(50, "表示名は 50 文字以内です"),
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
  plannedActivities: z
    .string()
    .min(1, "活動予定は必須です")
    .max(
      PROJECT_DRAFT_LIMITS.plannedActivities,
      `活動予定は ${PROJECT_DRAFT_LIMITS.plannedActivities} 文字以内です`
    ),
  snsLinks: snsLinksSchema,
  /** リクエスト元の IP アドレス（レートリミット用） */
  ipAddress: z.string().min(1, "IP アドレスは必須です"),
  /** CAPTCHA トークン */
  captchaToken: z.string().min(1, "CAPTCHA トークンは必須です"),
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

type DomainVoError = ProjectLocationError | SnsLinksError | ProjectDraftError;

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
    default: {
      // 将来 DomainVoError 配下の VO エラーに variant が追加された場合に
      // コンパイルエラーで気づけるようにする
      const _exhaustive: never = error;
      throw new Error(`Unknown DomainVoError variant: ${JSON.stringify(_exhaustive)}`);
    }
  }
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
    // 1. 入力バリデーション（Zod: 基本的な型・形式チェック）
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

    const draftResult = ProjectDraft.create({
      projectTitle: validated.projectTitle,
      projectSummary: validated.projectSummary,
      projectStory: validated.projectStory,
      projectCategory: validated.projectCategory,
      location: locationResult.value,
      plannedActivities: validated.plannedActivities,
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

    await this.port.executeInTransaction({
      account: {
        id: accountId,
        email: validated.email,
        displayName: validated.displayName.trim(),
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
        plannedActivities: draft.plannedActivities,
        snsLinks: snsLinks.isEmpty()
          ? null
          : {
              x: snsLinks.x,
              instagram: snsLinks.instagram,
              facebook: snsLinks.facebook,
              website: snsLinks.website,
            },
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
