import { db } from "../database/kysely/client";

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
 * Kysely ベースの ActivateAccountPort 実装（Prisma 版からの移行 / #223）
 *
 * `PrismaActivateAccountAdapter` と同一 API の drop-in。
 * - findByActivationToken: activationToken でアカウントを検索
 * - activate: status=ACTIVE, passwordHash セット, activationToken/Exp をクリア
 *
 * NOTE: 循環依存 (infrastructure → application) を避けるため、
 * Port インターフェースを直接 import せず、構造的部分型で適合する。
 */
export class KyselyActivateAccountAdapter {
  async findByActivationToken(token: string): Promise<AccountForActivation | null> {
    const row = await db
      .selectFrom("accounts")
      .select(["id", "status", "activationTokenExp"])
      .where("activationToken", "=", token)
      .executeTakeFirst();
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
    await db
      .updateTable("accounts")
      .set({
        status: "ACTIVE",
        passwordHash: params.passwordHash,
        activationToken: null,
        activationTokenExp: null,
        // Prisma の @updatedAt 相当（DB DEFAULT を持たないため明示的に更新する）
        updatedAt: new Date(),
      })
      .where("id", "=", params.accountId)
      .execute();
  }
}
