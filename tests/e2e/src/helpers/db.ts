import { prisma } from "@physifun/infrastructure";
import bcrypt from "bcryptjs";
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
  // AdminAccount 系は Account から独立 (#140 / #144)。
  // auditLog は adminAccountId を Restrict 参照しているため adminAccount より先に消す。
  // session も cascade ではあるが明示的に消して順序をわかりやすくする。
  await prisma.adminAuditLog.deleteMany();
  await prisma.adminSession.deleteMany();
  await prisma.adminAccount.deleteMany();
}

/**
 * E2E 用の運営アカウント (AdminAccount) を seed する (#140 / #144)。
 *
 * Phase 2 準備で Admin は Account から完全に分離された。
 * ここでは apps/admin 側の認証基盤で使う AdminAccount を直接作成する。
 *
 * - status: ACTIVE
 * - TOTP は未設定 (本来は #146 で初回ログイン時にセットアップ。E2E では現状スキップ)
 * - NextAuth が toLowerCase するので seed も小文字で揃える
 */
export async function seedAdminAccount(): Promise<{
  id: string;
  email: string;
  password: string;
}> {
  const passwordHash = await bcrypt.hash(TEST_ADMIN.password, 10);

  const admin = await prisma.adminAccount.create({
    data: {
      email: TEST_ADMIN.email,
      passwordHash,
      status: "ACTIVE",
      totpEnabled: false,
      recoveryCodes: [],
    },
  });

  return { id: admin.id, email: admin.email, password: TEST_ADMIN.password };
}

export { prisma };
