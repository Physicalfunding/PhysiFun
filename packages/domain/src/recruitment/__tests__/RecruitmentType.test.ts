import { describe, expect, it } from "vitest";
import {
  RecruitmentType,
  SUPPORT_RECRUITMENT_TYPE_VALUES,
  isRecruitmentType,
} from "../value-objects/RecruitmentType";

describe("RecruitmentType", () => {
  it("初回リリースの値は ACTIVITY だけ", () => {
    expect(SUPPORT_RECRUITMENT_TYPE_VALUES).toEqual([RecruitmentType.ACTIVITY]);
  });

  it("isRecruitmentType() は ACTIVITY を受け入れる", () => {
    expect(isRecruitmentType("ACTIVITY")).toBe(true);
  });

  it("isRecruitmentType() は他の値・文字列以外を拒否する", () => {
    expect(isRecruitmentType("SKILL_OR_ITEM")).toBe(false);
    // リーダー応募の募集タイプ（別の概念）は受け入れない
    expect(isRecruitmentType("TIME")).toBe(false);
    expect(isRecruitmentType("activity")).toBe(false);
    expect(isRecruitmentType(null)).toBe(false);
    expect(isRecruitmentType(1)).toBe(false);
  });
});
