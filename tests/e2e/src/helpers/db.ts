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
  await prisma.projectReviewFeedback.deleteMany();
  await prisma.projectOutboxMessage.deleteMany();
  await prisma.project.deleteMany();
  await prisma.leaderApplicationOutboxMessage.deleteMany();
  await prisma.leaderApplication.deleteMany();
  await prisma.account.deleteMany();
}

/**
 * E2E 用の admin アカウントを seed する。
 *
 * - status: ACTIVE
 * - roles: [SUPPORTER, ADMIN] (admin アプリは ADMIN 必須)
 * - passwordHash: bcrypt でハッシュ化
 *
 * email は NextAuth 側で toLowerCase されるため、seed も小文字で揃える。
 */
export async function seedAdminAccount(): Promise<{
  id: string;
  email: string;
  password: string;
}> {
  const passwordHash = await bcrypt.hash(TEST_ADMIN.password, 10);

  const admin = await prisma.account.create({
    data: {
      email: TEST_ADMIN.email,
      displayName: TEST_ADMIN.displayName,
      status: "ACTIVE",
      passwordHash,
      roles: ["SUPPORTER", "ADMIN"],
    },
  });

  return { id: admin.id, email: admin.email, password: TEST_ADMIN.password };
}

export { prisma };
