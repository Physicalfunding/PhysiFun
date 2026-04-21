import { prisma } from "../database/client";

/**
 * AdminAccount 認証成功時に返す情報
 *
 * Phase 2 以降、運営管理アプリの NextAuth authorize はこのアダプタを経由して
 * AdminAccount テーブルから認証対象を取得する (Account.roles ADMIN からの移行)。
 * TOTP 必須化は #146 で対応予定のため、本アダプタは totpSecret / totpEnabled を
 * そのまま返して呼び出し側 (NextAuth 層) で扱う。
 */
export interface AuthenticatedAdminAccount {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly totpEnabled: boolean;
}

/**
 * 運営管理アプリ用認証アダプタ
 *
 * - ACTIVE な AdminAccount のみ返す。
 * - UseCase ではなく NextAuth callback から直接使う想定のため、
 *   application 層に Port を置かず infrastructure 層内で完結させる
 *   (従来の PrismaAuthenticateAdapter と同じ設計方針)。
 */
export class PrismaAdminAuthenticateAdapter {
  async findActiveAdminAccountByEmail(email: string): Promise<AuthenticatedAdminAccount | null> {
    const row = await prisma.adminAccount.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        status: true,
        passwordHash: true,
        totpEnabled: true,
      },
    });
    if (!row) return null;
    if (row.status !== "ACTIVE") return null;
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      totpEnabled: row.totpEnabled,
    };
  }
}
