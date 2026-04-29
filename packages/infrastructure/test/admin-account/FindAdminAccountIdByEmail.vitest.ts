import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { findAdminAccountIdByEmail } from "../../src/admin-account/findAdminAccountIdByEmail";
import { disconnectTestPrisma, getTestPrisma, resetDatabase } from "../helpers/prisma";

/**
 * findAdminAccountIdByEmail の integration test (#146 B-1)
 *
 * `findAdminAccountIdByEmail` は NextAuth route handler の
 * `recordSignatureInvalid` で email → AdminAccount.id の解決に使われる。
 * FK 制約を持つ AdminAuditLog への書き込みのため、次の契約を担保する:
 *
 * 1. ACTIVE な AdminAccount は id を返す
 * 2. DISABLED な AdminAccount も id を返す (status 無視 - 攻撃試行を監査に残すため)
 * 3. 未登録 email は null を返す
 * 4. email は trim + lowercase で正規化される
 * 5. 空文字 / 空白のみの email は null を返す (早期リターン)
 */
describe("findAdminAccountIdByEmail integration", () => {
  const prisma = getTestPrisma();

  beforeAll(async () => {
    await resetDatabase(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it("ACTIVE な AdminAccount の id を返す", async () => {
    const admin = await prisma.adminAccount.create({
      data: {
        email: "active-admin@example.com",
        status: "ACTIVE",
      },
    });

    const result = await findAdminAccountIdByEmail("active-admin@example.com");

    expect(result).toBe(admin.id);
  });

  it("DISABLED な AdminAccount も id を返す (status 無視 / 攻撃試行の監査目的)", async () => {
    const admin = await prisma.adminAccount.create({
      data: {
        email: "disabled-admin@example.com",
        status: "DISABLED",
      },
    });

    const result = await findAdminAccountIdByEmail("disabled-admin@example.com");

    expect(result).toBe(admin.id);
  });

  it("未登録の email は null を返す", async () => {
    const result = await findAdminAccountIdByEmail("unknown@example.com");

    expect(result).toBeNull();
  });

  it("email は trim + lowercase に正規化される", async () => {
    const admin = await prisma.adminAccount.create({
      data: {
        email: "normalize-me@example.com",
        status: "ACTIVE",
      },
    });

    const result = await findAdminAccountIdByEmail("  Normalize-ME@Example.COM  ");

    expect(result).toBe(admin.id);
  });

  it("空文字 / 空白のみの email は null を返す (DB アクセスせず早期リターン)", async () => {
    expect(await findAdminAccountIdByEmail("")).toBeNull();
    expect(await findAdminAccountIdByEmail("   ")).toBeNull();
  });
});
