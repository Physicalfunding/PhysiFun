import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaProjectCommandAdapter } from "../../src/project/PrismaProjectCommandAdapter";
import { PrismaApproveLeaderApplicationAdapter } from "../../src/leader-application/PrismaApproveLeaderApplicationAdapter";
import { disconnectTestPrisma, getTestPrisma, resetDatabase } from "../helpers/prisma";

/**
 * findAdminReviewerById の integration test (#158 M6)
 *
 * `findAdminReviewerById` は LeaderApplication 承認 / Project 承認・却下・強制非公開の
 * reviewer 検証に使われており、「存在しない」「DISABLED」のいずれも
 * null にマップして UseCase 層で REVIEWER_NOT_FOUND として扱う契約。
 *
 * Unit test だけでは status enum のマッピングを実 DB で確認できないため、
 * Testcontainers 上の実 Postgres でこの契約を担保する。
 */
describe("findAdminReviewerById (AdminAccount lookup) integration", () => {
  const prisma = getTestPrisma();
  const projectAdapter = new PrismaProjectCommandAdapter();
  const leaderApplicationAdapter = new PrismaApproveLeaderApplicationAdapter();

  beforeAll(async () => {
    await resetDatabase(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  describe("PrismaProjectCommandAdapter.findAdminReviewerById", () => {
    it("ACTIVE な AdminAccount は { id, email } を返す", async () => {
      const admin = await prisma.adminAccount.create({
        data: {
          email: "active-admin@example.com",
          status: "ACTIVE",
        },
      });

      const result = await projectAdapter.findAdminReviewerById(admin.id);

      expect(result).toEqual({ id: admin.id, email: "active-admin@example.com" });
    });

    it("DISABLED な AdminAccount は null を返す (未存在と区別しない契約)", async () => {
      const admin = await prisma.adminAccount.create({
        data: {
          email: "disabled-admin@example.com",
          status: "DISABLED",
        },
      });

      const result = await projectAdapter.findAdminReviewerById(admin.id);

      expect(result).toBeNull();
    });

    it("存在しない ID は null を返す", async () => {
      // ランダム UUID (実データに存在しないもの)
      const result = await projectAdapter.findAdminReviewerById(
        "00000000-0000-4000-8000-000000000000"
      );

      expect(result).toBeNull();
    });
  });

  describe("PrismaApproveLeaderApplicationAdapter.findAdminReviewerById", () => {
    it("ACTIVE な AdminAccount は { id, email } を返す", async () => {
      const admin = await prisma.adminAccount.create({
        data: {
          email: "la-active-admin@example.com",
          status: "ACTIVE",
        },
      });

      const result = await leaderApplicationAdapter.findAdminReviewerById(admin.id);

      expect(result).toEqual({ id: admin.id, email: "la-active-admin@example.com" });
    });

    it("DISABLED な AdminAccount は null を返す", async () => {
      const admin = await prisma.adminAccount.create({
        data: {
          email: "la-disabled-admin@example.com",
          status: "DISABLED",
        },
      });

      const result = await leaderApplicationAdapter.findAdminReviewerById(admin.id);

      expect(result).toBeNull();
    });

    it("存在しない ID は null を返す", async () => {
      const result = await leaderApplicationAdapter.findAdminReviewerById(
        "00000000-0000-4000-8000-000000000001"
      );

      expect(result).toBeNull();
    });
  });
});
