import { z } from "zod";
import { type Result, ok, err } from "@physifun/domain";
import type { ActivateAccountPort, PasswordHasher } from "./ports/ActivateAccountPort";

// --- 入力バリデーションスキーマ ---

const activateAccountInputSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(1),
});

// --- パスワードポリシー（B-8: 暫定ルール） ---

/** 最低8文字、英字と数字の両方を含むこと */
const PASSWORD_MIN_LENGTH = 8;
const HAS_LETTER = /[a-zA-Z]/;
const HAS_DIGIT = /[0-9]/;

// --- エラー型 ---

export type ActivateAccountError =
  | { type: "INVALID_INPUT"; issues: z.ZodIssue[] }
  | { type: "TOKEN_NOT_FOUND" }
  | { type: "TOKEN_EXPIRED" }
  | { type: "ACCOUNT_ALREADY_ACTIVE" }
  | { type: "INVALID_PASSWORD"; reason: string };

// --- 成功型 ---

export interface ActivateAccountResult {
  accountId: string;
}

// --- ユースケース ---

export class ActivateAccountUseCase {
  constructor(
    private readonly port: ActivateAccountPort,
    private readonly passwordHasher: PasswordHasher
  ) {}

  async execute(input: {
    token: string;
    password: string;
  }): Promise<Result<ActivateAccountResult, ActivateAccountError>> {
    // 1. 入力バリデーション
    const parsed = activateAccountInputSchema.safeParse(input);
    if (!parsed.success) {
      return err({ type: "INVALID_INPUT", issues: parsed.error.issues });
    }

    const { token, password } = parsed.data;

    // 2. トークンでアカウントを検索
    const account = await this.port.findByActivationToken(token);
    if (!account) {
      return err({ type: "TOKEN_NOT_FOUND" });
    }

    // 3. アカウントステータスの確認
    if (account.status !== "PENDING_EMAIL_CONFIRMATION") {
      return err({ type: "ACCOUNT_ALREADY_ACTIVE" });
    }

    // 4. トークン有効期限の確認
    if (!account.activationTokenExp || account.activationTokenExp < new Date()) {
      return err({ type: "TOKEN_EXPIRED" });
    }

    // 5. パスワードポリシーの検証
    const passwordError = validatePassword(password);
    if (passwordError) {
      return err({ type: "INVALID_PASSWORD", reason: passwordError });
    }

    // 6. パスワードハッシュ化
    const passwordHash = await this.passwordHasher.hash(password);

    // 7. アカウント有効化
    await this.port.activate({
      accountId: account.id,
      passwordHash,
    });

    return ok({ accountId: account.id });
  }
}

/** パスワードポリシー検証。問題なければ null、違反時はエラー理由を返す */
function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `パスワードは${PASSWORD_MIN_LENGTH}文字以上で入力してください`;
  }
  if (!HAS_LETTER.test(password)) {
    return "パスワードには英字を含めてください";
  }
  if (!HAS_DIGIT.test(password)) {
    return "パスワードには数字を含めてください";
  }
  return null;
}
