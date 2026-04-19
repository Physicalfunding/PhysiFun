import { describe, it, expect } from "@jest/globals";
import { BcryptPasswordHasher } from "../BcryptPasswordHasher";

describe("BcryptPasswordHasher", () => {
  // cost 4 は bcrypt の最小値。テスト高速化のため使用する。
  const hasher = new BcryptPasswordHasher(4);

  it("hash した結果は平文と一致せず、bcrypt 形式のハッシュ ($2a$ / $2b$ で始まる)", async () => {
    const password = "Password123";
    const hash = await hasher.hash(password);

    expect(hash).not.toBe(password);
    expect(hash).toMatch(/^\$2[aby]\$/);
  });

  it("同じ平文でも異なる salt により毎回異なるハッシュになる", async () => {
    const password = "Password123";
    const h1 = await hasher.hash(password);
    const h2 = await hasher.hash(password);
    expect(h1).not.toBe(h2);
  });

  it("compare: 正しい平文と対応するハッシュで true", async () => {
    const password = "Password123";
    const hash = await hasher.hash(password);
    await expect(hasher.compare(password, hash)).resolves.toBe(true);
  });

  it("compare: 間違った平文で false", async () => {
    const hash = await hasher.hash("Password123");
    await expect(hasher.compare("WrongPassword", hash)).resolves.toBe(false);
  });

  it("compare: 空文字列の平文で false", async () => {
    const hash = await hasher.hash("Password123");
    await expect(hasher.compare("", hash)).resolves.toBe(false);
  });
});
