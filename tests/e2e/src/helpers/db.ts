import { randomUUID } from "node:crypto";
import { prisma } from "@physifun/infrastructure";
import { TEST_ADMIN } from "../fixtures";

/**
 * 全テーブルを FK 依存順で truncate する。
 *
 * Phase 1 の全テーブルを deleteMany で空にする。
 * deleteMany は TRUNCATE より遅いが、Prisma の型安全が効き、
 * FK CASCADE を明示的にコントロールできるのでテスト用途では十分。
 */
export async function truncateAll(): Promise<void> {
  // FK の子から親の順序で削除する
  await prisma.supportTicket.deleteMany();
  await prisma.recruitmentSchedule.deleteMany();
  await prisma.supportRecruitment.deleteMany();
  // Project / LeaderApplication は AdminAccount を reviewer として参照する (onDelete: Restrict)
  // ため、AdminAccount 削除より先に消す必要がある。
  await prisma.projectReviewFeedback.deleteMany();
  await prisma.projectOutboxMessage.deleteMany();
  await prisma.project.deleteMany();
  await prisma.leaderApplicationOutboxMessage.deleteMany();
  await prisma.leaderApplication.deleteMany();
  await prisma.account.deleteMany();
  // AdminAccount 系は Account から独立 (#140 / #144 / #145)。
  // auditLog は adminAccountId を Restrict 参照しているため adminAccount より先に消す。
  await prisma.adminAuditLog.deleteMany();
  await prisma.adminSession.deleteMany();
  await prisma.adminVerificationToken.deleteMany();
  await prisma.adminAccount.deleteMany();
}

/**
 * E2E 用の運営アカウント (AdminAccount) を seed する (#140 / #144 / #145)。
 *
 * #145 でマジックリンク方式に切替したためパスワードは不要。
 * E2E ではマジックリンクのメール送信フローを経由せず、`seedAdminSession` で
 * AdminSession 行を直接 INSERT してログイン済み状態にする。
 */
export async function seedAdminAccount(): Promise<{
  id: string;
  email: string;
}> {
  const admin = await prisma.adminAccount.create({
    data: {
      email: TEST_ADMIN.email,
      status: "ACTIVE",
    },
  });
  return { id: admin.id, email: admin.email };
}

/**
 * E2E 用にログイン済みセッションを DB 直接作成する (#145)。
 *
 * NextAuth Database 戦略では `next-auth.session-token` Cookie の値が
 * AdminSession.sessionToken と一致する行を見つけたらログイン済みと判定される。
 * マジックリンクのメール受信・クリックをテスト内でエミュレートすると複雑になるため、
 * セッションレコードを直接 INSERT して Cookie 経由でログインを偽装する。
 *
 * @returns sessionToken (Playwright の context.addCookies で注入する値)
 */
export async function seedAdminSession(params: {
  adminAccountId: string;
  expiresInMs?: number;
}): Promise<{ sessionToken: string; expires: Date }> {
  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + (params.expiresInMs ?? 60 * 60 * 1000));
  await prisma.adminSession.create({
    data: {
      sessionToken,
      adminAccountId: params.adminAccountId,
      expires,
    },
  });
  return { sessionToken, expires };
}

export { prisma };
