import { describe, expect, it } from "@jest/globals";
import {
  CATEGORY_MASTER,
  type ProjectCategory,
  isProjectCategory,
} from "../value-objects/ProjectCategory";

describe("ProjectCategory", () => {
  it("CATEGORY_MASTER は 7 値を持つ", () => {
    expect(CATEGORY_MASTER).toHaveLength(7);
  });

  it("isProjectCategory は定義済み値に対して true を返す", () => {
    for (const { value } of CATEGORY_MASTER) {
      expect(isProjectCategory(value)).toBe(true);
    }
  });

  it("isProjectCategory は未定義値に対して false を返す", () => {
    expect(isProjectCategory("INVALID")).toBe(false);
    expect(isProjectCategory("")).toBe(false);
  });

  it("型の値域として使える", () => {
    const c: ProjectCategory = "KOMINKA";
    expect(isProjectCategory(c)).toBe(true);
  });
});
