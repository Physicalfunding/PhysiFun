import { randomBytes, randomUUID } from "node:crypto";
import { type Result, err, ok } from "@physifun/domain";
import { z } from "zod";
import type { SubmitLeaderApplicationPort } from "./ports/SubmitLeaderApplicationPort";

// ==================== 入力バリデーション ====================

/**
 * 都道府県コードの正規表現 (JIS X 0401: "01"〜"47")
 */
const PREFECTURE_CODE_REGEX = /^(?:0[1-9]|[1-3][0-9]|4[0-7])$/;

/**
 * 許可されるプロジェクトカテゴリ値
 */
const PROJECT_CATEGORIES = [
  "KOMINKA",
  "RICE_FARMING",
  "FARMING",
  "DIY",
  "EVENT",
  "COMMUNITY",
  "OTHER",
] as const;

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
 */
export const submitLeaderApplicationInputSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  displayName: z.string().min(1, "表示名は必須です").max(50, "表示名は 50 文字以内です"),
  projectTitle: z
    .string()
    .min(1, "プロジェクトタイトルは必須です")
    .max(100, "プロジェクトタイトルは 100 文字以内です"),
  projectSummary: z
    .string()
    .min(1, "プロジェクト概要は必須です")
    .max(300, "プロジェクト概要は 300 文字以内です"),
  projectStory: z
    .string()
    .min(1, "プロジェクトストーリーは必須です")
    .max(5000, "プロジェクトストーリーは 5000 文字以内です"),
  projectCategory: z.enum(PROJECT_CATEGORIES, {
    errorMap: () => ({ message: "無効なプロジェクトカテゴリです" }),
  }),
  prefectureCode: z.string().regex(PREFECTURE_CODE_REGEX, {
    message: "無効な都道府県コードです",
  }),
  municipality: z.string().max(50, "市区町村は 50 文字以内です").nullish(),
  plannedActivities: z
    .string()
    .min(1, "活動予定は必須です")
    .max(1000, "活動予定は 1000 文字以内です"),
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

// ==================== ユースケース ====================

/**
 * リーダー応募を送信するユースケース
 *
 * 1. 入力バリデーション（Zod）
 * 2. IP レートリミットチェック（スタブ）
 * 3. CAPTCHA 検証（スタブ）
 * 4. 重複チェック（同一メールで PENDING / PENDING_EMAIL_CONFIRMATION のアカウントが存在しないか）
 * 5. Account 作成（PENDING_EMAIL_CONFIRMATION, roles: [SUPPORTER]）
 * 6. LeaderApplication 作成（PENDING）
 * 7. OutboxMessage 作成（ACTIVATION_EMAIL）
 * 8. 上記 5〜7 をトランザクションで実行
 */
export class SubmitLeaderApplicationUseCase {
  constructor(private readonly port: SubmitLeaderApplicationPort) {}

  async execute(
    input: unknown
  ): Promise<Result<SubmitLeaderApplicationOutput, SubmitLeaderApplicationError>> {
    // 1. 入力バリデーション
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

    // 4. 重複チェック
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

    // 5〜8. ID 生成 → トランザクション実行
    const accountId = randomUUID();
    const applicationId = randomUUID();
    const outboxMessageId = randomUUID();
    const activationToken = generateActivationToken();
    const now = new Date();
    const activationTokenExp = new Date(now.getTime() + ACTIVATION_TOKEN_EXPIRY_MS);

    // SNS リンクの正規化
    const snsLinksPayload = validated.snsLinks
      ? {
          x: validated.snsLinks.x?.trim() || null,
          instagram: validated.snsLinks.instagram?.trim() || null,
          facebook: validated.snsLinks.facebook?.trim() || null,
          website: validated.snsLinks.website?.trim() || null,
        }
      : null;

    // SNS リンクが全部 null なら null にする
    const hasSnsLink =
      snsLinksPayload &&
      (snsLinksPayload.x ||
        snsLinksPayload.instagram ||
        snsLinksPayload.facebook ||
        snsLinksPayload.website);

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
        projectTitle: validated.projectTitle.trim(),
        projectSummary: validated.projectSummary.trim(),
        projectStory: validated.projectStory.trim(),
        projectCategory: validated.projectCategory,
        prefectureCode: validated.prefectureCode,
        municipality: validated.municipality?.trim() || null,
        plannedActivities: validated.plannedActivities.trim(),
        snsLinks: hasSnsLink ? snsLinksPayload : null,
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
