import { prisma } from "../database/client";

/**
 * アカウント有効化に必要な最小限のアカウント情報
 *
 * application 層の ActivateAccountPort.AccountForActivation と同一の型。
 * 循環依存 (infrastructure → application) を避けるためここで定義する。
 */
export interface AccountForActivation {
  id: string;
  status: "PENDING_EMAIL_CONFIRMATION" | "ACTIVE";
  activationTokenExp: Date | null;
}

/**
 * Prisma ベースの ActivateAccountPort 実装
 *
 * application 層の ActivateAccountPort インターフェースに構造的部分型で適合する。
 * - findByActivationToken: activationToken でアカウントを検索
 * - activate: status=ACTIVE, passwordHash セット, activationToken/Exp をクリア
 */
export class PrismaActivateAccountAdapter {
  async findByActivationToken(token: string): Promise<AccountForActivation | null> {
    const row = await prisma.account.findUnique({
      where: { activationToken: token },
      select: { id: true, status: true, activationTokenExp: true },
    });
    if (!row) return null;
    // AccountForActivation.status は PENDING_EMAIL_CONFIRMATION | ACTIVE のみ。
    // 将来 AccountStatus enum に SUSPENDED 等が追加された場合、
    // ここで null を返してアクティベート不可扱いにする（呼び出し元の TOKEN_NOT_FOUND として解釈される）。
    if (row.status !== "PENDING_EMAIL_CONFIRMATION" && row.status !== "ACTIVE") {
      return null;
    }
    return {
      id: row.id,
      status: row.status,
      activationTokenExp: row.activationTokenExp,
    };
  }

  async activate(params: { accountId: string; passwordHash: string }): Promise<void> {
    await prisma.account.update({
      where: { id: params.accountId },
      data: {
        status: "ACTIVE",
        passwordHash: params.passwordHash,
        activationToken: null,
        activationTokenExp: null,
      },
    });
  }
}
