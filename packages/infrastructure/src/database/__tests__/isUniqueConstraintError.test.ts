import { describe, it, expect } from "@jest/globals";
import { DatabaseError } from "pg";
import { isUniqueConstraintError } from "../isUniqueConstraintError";

/**
 * pg の DatabaseError を組み立てるヘルパー。
 * node-postgres は ErrorResponse のパース時に `code` を後付けするため、テストでも同様に代入する。
 */
function makePgError(code: string): DatabaseError {
  const err = new DatabaseError("duplicate key value violates unique constraint", 100, "error");
  err.code = code;
  return err;
}

describe("isUniqueConstraintError", () => {
  it("pg の一意制約違反 (SQLSTATE 23505) で true", () => {
    expect(isUniqueConstraintError(makePgError("23505"))).toBe(true);
  });

  it("23505 以外の pg エラーコード (例: 23503 FK 違反) では false", () => {
    expect(isUniqueConstraintError(makePgError("23503"))).toBe(false);
  });

  it("code 未設定の DatabaseError では false", () => {
    const err = new DatabaseError("boom", 100, "error");
    expect(isUniqueConstraintError(err)).toBe(false);
  });

  it("DatabaseError でない素の Error は code を偽装しても false (型安全に弾く)", () => {
    const fake = new Error("dup") as Error & { code?: string };
    fake.code = "23505";
    expect(isUniqueConstraintError(fake)).toBe(false);
  });

  it("null / undefined / プリミティブ / プレーンオブジェクトでは false", () => {
    expect(isUniqueConstraintError(null)).toBe(false);
    expect(isUniqueConstraintError(undefined)).toBe(false);
    expect(isUniqueConstraintError("23505")).toBe(false);
    expect(isUniqueConstraintError({ code: "23505" })).toBe(false);
  });
});
