import { describe, expect, it } from "@jest/globals";
import { AdminAccount } from "../entities/AdminAccount";
import { AdminAccountEmail } from "../value-objects/AdminAccountEmail";
import { AdminAccountId } from "../value-objects/AdminAccountId";
import { AdminAccountStatus } from "../value-objects/AdminAccountStatus";
import { HashedPassword } from "../value-objects/HashedPassword";
import { RecoveryCodeHash } from "../value-objects/RecoveryCodeHash";
import { TotpSecret } from "../value-objects/TotpSecret";

function email(value = "admin@example.com"): AdminAccountEmail {
  const r = AdminAccountEmail.from(value);
  if (!r.ok) throw new Error("test fixture: email");
  return r.value;
}

function hash(value = "$2b$10$abcdefghijklmnopqrstuv"): HashedPassword {
  const r = HashedPassword.from(value);
  if (!r.ok) throw new Error("test fixture: hash");
  return r.value;
}

function totp(value = "encrypted-totp-secret"): TotpSecret {
  const r = TotpSecret.from(value);
  if (!r.ok) throw new Error("test fixture: totp");
  return r.value;
}

function recoveryCode(value: string): RecoveryCodeHash {
  const r = RecoveryCodeHash.from(value);
  if (!r.ok) throw new Error("test fixture: recovery code");
  return r.value;
}

describe("AdminAccount", () => {
  describe("create", () => {
    it("ACTIVE / totpEnabled=false / recoveryCodes=[] で生成される", () => {
      const now = new Date("2026-04-21T00:00:00Z");
      const account = AdminAccount.create({ email: email(), passwordHash: hash(), now });

      expect(account.status).toBe(AdminAccountStatus.ACTIVE);
      expect(account.totpEnabled).toBe(false);
      expect(account.totpSecret).toBeNull();
      expect(account.recoveryCodes).toEqual([]);
      expect(account.lastLoginAt).toBeNull();
      expect(account.createdAt).toBe(now);
      expect(account.updatedAt).toBe(now);
    });

    it("id を省略すると新規 AdminAccountId が割り当てられる", () => {
      const a = AdminAccount.create({ email: email("a@example.com"), passwordHash: hash() });
      const b = AdminAccount.create({ email: email("b@example.com"), passwordHash: hash() });
      expect(a.id.equals(b.id)).toBe(false);
    });
  });

  describe("disable / enable", () => {
    it("ACTIVE → DISABLED に遷移する", () => {
      const account = AdminAccount.create({ email: email(), passwordHash: hash() });
      const result = account.disable();
      expect(result.ok).toBe(true);
      expect(account.status).toBe(AdminAccountStatus.DISABLED);
    });

    it("DISABLED を再度 disable するとエラー", () => {
      const account = AdminAccount.create({ email: email(), passwordHash: hash() });
      account.disable();
      const result = account.disable();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("CANNOT_DISABLE_ALREADY_DISABLED");
      }
    });

    it("DISABLED → ACTIVE に再有効化できる", () => {
      const account = AdminAccount.create({ email: email(), passwordHash: hash() });
      account.disable();
      account.enable();
      expect(account.status).toBe(AdminAccountStatus.ACTIVE);
    });
  });

  describe("enableTotp", () => {
    it("未設定から TOTP を有効化できる", () => {
      const account = AdminAccount.create({ email: email(), passwordHash: hash() });
      const result = account.enableTotp({
        secret: totp(),
        recoveryCodes: [recoveryCode("h1"), recoveryCode("h2")],
      });
      expect(result.ok).toBe(true);
      expect(account.totpEnabled).toBe(true);
      expect(account.recoveryCodes).toHaveLength(2);
    });

    it("既に有効化済みならエラー", () => {
      const account = AdminAccount.create({ email: email(), passwordHash: hash() });
      account.enableTotp({ secret: totp(), recoveryCodes: [] });
      const result = account.enableTotp({ secret: totp("another"), recoveryCodes: [] });
      expect(result.ok).toBe(false);
    });

    it("DISABLED 状態では TOTP を有効化できない", () => {
      const account = AdminAccount.create({ email: email(), passwordHash: hash() });
      account.disable();
      const result = account.enableTotp({ secret: totp(), recoveryCodes: [] });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("ACCOUNT_DISABLED");
      }
    });
  });

  describe("recordLogin", () => {
    it("lastLoginAt と updatedAt を更新する", () => {
      const account = AdminAccount.create({ email: email(), passwordHash: hash() });
      const at = new Date("2026-04-21T05:00:00Z");
      account.recordLogin({ at });
      expect(account.lastLoginAt).toBe(at);
      expect(account.updatedAt).toBe(at);
    });
  });

  describe("reconstruct", () => {
    it("DB 値をそのまま復元する", () => {
      const id = AdminAccountId.generate();
      const now = new Date("2026-04-20T00:00:00Z");
      const account = AdminAccount.reconstruct({
        id,
        email: email(),
        passwordHash: hash(),
        totpSecret: totp(),
        totpEnabled: true,
        recoveryCodes: [recoveryCode("h")],
        status: AdminAccountStatus.DISABLED,
        lastLoginAt: now,
        createdAt: now,
        updatedAt: now,
      });
      expect(account.id.equals(id)).toBe(true);
      expect(account.status).toBe(AdminAccountStatus.DISABLED);
      expect(account.totpEnabled).toBe(true);
      expect(account.recoveryCodes).toHaveLength(1);
    });
  });
});
