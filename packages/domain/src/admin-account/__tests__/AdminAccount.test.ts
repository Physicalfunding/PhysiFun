import { describe, expect, it } from "@jest/globals";
import { AdminAccount } from "../entities/AdminAccount";
import { AdminAccountEmail } from "../value-objects/AdminAccountEmail";
import { AdminAccountId } from "../value-objects/AdminAccountId";
import { AdminAccountStatus } from "../value-objects/AdminAccountStatus";

function email(value = "admin@example.com"): AdminAccountEmail {
  const r = AdminAccountEmail.from(value);
  if (!r.ok) throw new Error("test fixture: email");
  return r.value;
}

describe("AdminAccount", () => {
  describe("create", () => {
    it("ACTIVE / lastLoginAt=null で生成される", () => {
      const now = new Date("2026-04-21T00:00:00Z");
      const account = AdminAccount.create({ email: email(), now });

      expect(account.status).toBe(AdminAccountStatus.ACTIVE);
      expect(account.lastLoginAt).toBeNull();
      expect(account.createdAt).toBe(now);
      expect(account.updatedAt).toBe(now);
    });

    it("id を省略すると新規 AdminAccountId が割り当てられる", () => {
      const a = AdminAccount.create({ email: email("a@example.com") });
      const b = AdminAccount.create({ email: email("b@example.com") });
      expect(a.id.equals(b.id)).toBe(false);
    });
  });

  describe("disable / enable", () => {
    it("ACTIVE → DISABLED に遷移する", () => {
      const account = AdminAccount.create({ email: email() });
      const result = account.disable();
      expect(result.ok).toBe(true);
      expect(account.status).toBe(AdminAccountStatus.DISABLED);
    });

    it("DISABLED を再度 disable するとエラー", () => {
      const account = AdminAccount.create({ email: email() });
      account.disable();
      const result = account.disable();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("CANNOT_DISABLE_ALREADY_DISABLED");
      }
    });

    it("DISABLED → ACTIVE に再有効化できる", () => {
      const account = AdminAccount.create({ email: email() });
      account.disable();
      account.enable();
      expect(account.status).toBe(AdminAccountStatus.ACTIVE);
    });

    it("ACTIVE を再度 enable() しても冪等で副作用がない", () => {
      // enable() は disable() と意図的に非対称 (Result を返さず void)。
      // 運営 UI で既に ACTIVE の AdminAccount を再有効化してもエラーにしない。
      const account = AdminAccount.create({ email: email() });
      const before = account.updatedAt;
      account.enable();
      expect(account.status).toBe(AdminAccountStatus.ACTIVE);
      // updatedAt は変化しない (既に ACTIVE なので touch しない)
      expect(account.updatedAt).toBe(before);
    });
  });

  describe("recordLogin", () => {
    it("lastLoginAt と updatedAt を更新する", () => {
      const account = AdminAccount.create({ email: email() });
      const at = new Date("2026-04-21T05:00:00Z");
      account.recordLogin({ at });
      expect(account.lastLoginAt).toBe(at);
      expect(account.updatedAt).toBe(at);
    });

    it("DISABLED 状態でも lastLoginAt を更新できる (呼び出し側が status を確認する責務)", () => {
      // recordLogin は状態ガードを持たず、認証成功後の記録にのみ使う。
      // DISABLED アカウントでの認証拒否は application 層 / 認証基盤の責務。
      const account = AdminAccount.create({ email: email() });
      account.disable();
      const at = new Date("2026-04-21T05:00:00Z");
      account.recordLogin({ at });
      expect(account.lastLoginAt).toBe(at);
    });
  });

  describe("reconstruct", () => {
    it("DB 値をそのまま復元する", () => {
      const id = AdminAccountId.generate();
      const now = new Date("2026-04-20T00:00:00Z");
      const account = AdminAccount.reconstruct({
        id,
        email: email(),
        status: AdminAccountStatus.DISABLED,
        lastLoginAt: now,
        createdAt: now,
        updatedAt: now,
      });
      expect(account.id.equals(id)).toBe(true);
      expect(account.status).toBe(AdminAccountStatus.DISABLED);
      expect(account.lastLoginAt).toBe(now);
    });
  });
});
