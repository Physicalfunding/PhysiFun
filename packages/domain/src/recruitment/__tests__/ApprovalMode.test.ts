import { describe, expect, it } from "vitest";
import { APPROVAL_MODE_VALUES, ApprovalMode, isApprovalMode } from "../value-objects/ApprovalMode";

describe("ApprovalMode", () => {
  it("値は AUTO と MANUAL", () => {
    expect(APPROVAL_MODE_VALUES).toEqual([ApprovalMode.AUTO, ApprovalMode.MANUAL]);
  });

  it("isApprovalMode() は AUTO / MANUAL を受け入れる", () => {
    expect(isApprovalMode("AUTO")).toBe(true);
    expect(isApprovalMode("MANUAL")).toBe(true);
  });

  it("isApprovalMode() は他の値・文字列以外を拒否する", () => {
    expect(isApprovalMode("auto")).toBe(false);
    expect(isApprovalMode("")).toBe(false);
    expect(isApprovalMode(undefined)).toBe(false);
    expect(isApprovalMode(0)).toBe(false);
  });
});
