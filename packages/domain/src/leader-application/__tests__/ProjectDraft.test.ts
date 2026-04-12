import { describe, expect, it } from "@jest/globals";
import { PROJECT_DRAFT_LIMITS, ProjectDraft } from "../value-objects/ProjectDraft";
import { ProjectLocation } from "../value-objects/ProjectLocation";
import { SnsLinks } from "../value-objects/SnsLinks";

function validLocation(): ProjectLocation {
  const r = ProjectLocation.create({ prefectureCode: "13" });
  if (!r.ok) throw new Error("test fixture broken: ProjectLocation");
  return r.value;
}

function emptySns(): SnsLinks {
  const r = SnsLinks.create({});
  if (!r.ok) throw new Error("test fixture broken: SnsLinks");
  return r.value;
}

function validInput(): Parameters<typeof ProjectDraft.create>[0] {
  return {
    projectTitle: "古民家再生プロジェクト",
    projectSummary: "築100年の古民家をコミュニティ拠点として再生する",
    projectStory: "# 想い\n古民家に込められた歴史を次世代に繋ぎたい...",
    projectCategory: "KOMINKA",
    location: validLocation(),
    plannedActivities: "週末 DIY イベント、解体作業、清掃活動",
    snsLinks: emptySns(),
  };
}

describe("ProjectDraft", () => {
  describe("create", () => {
    it("有効な入力で生成できる", () => {
      const result = ProjectDraft.create(validInput());
      expect(result.ok).toBe(true);
    });

    it("文字列は前後の空白がトリムされる", () => {
      const result = ProjectDraft.create({
        ...validInput(),
        projectTitle: "  古民家再生  ",
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.projectTitle).toBe("古民家再生");
      }
    });

    describe("projectTitle", () => {
      it("空文字はエラー", () => {
        const result = ProjectDraft.create({
          ...validInput(),
          projectTitle: "",
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.type).toBe("REQUIRED_TEXT_EMPTY");
          if (result.error.type === "REQUIRED_TEXT_EMPTY") {
            expect(result.error.field).toBe("projectTitle");
          }
        }
      });

      it("空白のみはエラー（トリム後空）", () => {
        const result = ProjectDraft.create({
          ...validInput(),
          projectTitle: "   ",
        });
        expect(result.ok).toBe(false);
      });

      it("100 文字ちょうどは OK", () => {
        const result = ProjectDraft.create({
          ...validInput(),
          projectTitle: "あ".repeat(100),
        });
        expect(result.ok).toBe(true);
      });

      it("101 文字はエラー", () => {
        const result = ProjectDraft.create({
          ...validInput(),
          projectTitle: "あ".repeat(101),
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.type).toBe("TEXT_TOO_LONG");
          if (result.error.type === "TEXT_TOO_LONG") {
            expect(result.error.field).toBe("projectTitle");
            expect(result.error.maxLength).toBe(100);
          }
        }
      });
    });

    describe("projectSummary", () => {
      it("空文字はエラー", () => {
        const result = ProjectDraft.create({
          ...validInput(),
          projectSummary: "",
        });
        expect(result.ok).toBe(false);
      });

      it("300 文字ちょうどは OK", () => {
        const result = ProjectDraft.create({
          ...validInput(),
          projectSummary: "a".repeat(300),
        });
        expect(result.ok).toBe(true);
      });

      it("301 文字はエラー", () => {
        const result = ProjectDraft.create({
          ...validInput(),
          projectSummary: "a".repeat(301),
        });
        expect(result.ok).toBe(false);
      });
    });

    describe("projectStory", () => {
      it("空文字はエラー", () => {
        const result = ProjectDraft.create({
          ...validInput(),
          projectStory: "",
        });
        expect(result.ok).toBe(false);
      });

      it("5000 文字ちょうどは OK", () => {
        const result = ProjectDraft.create({
          ...validInput(),
          projectStory: "a".repeat(5000),
        });
        expect(result.ok).toBe(true);
      });

      it("5001 文字はエラー", () => {
        const result = ProjectDraft.create({
          ...validInput(),
          projectStory: "a".repeat(5001),
        });
        expect(result.ok).toBe(false);
      });
    });

    describe("plannedActivities", () => {
      it("空文字はエラー", () => {
        const result = ProjectDraft.create({
          ...validInput(),
          plannedActivities: "",
        });
        expect(result.ok).toBe(false);
      });

      it("1000 文字ちょうどは OK", () => {
        const result = ProjectDraft.create({
          ...validInput(),
          plannedActivities: "a".repeat(1000),
        });
        expect(result.ok).toBe(true);
      });

      it("1001 文字はエラー", () => {
        const result = ProjectDraft.create({
          ...validInput(),
          plannedActivities: "a".repeat(1001),
        });
        expect(result.ok).toBe(false);
      });
    });

    describe("projectCategory", () => {
      it("CATEGORY_MASTER の値なら OK", () => {
        const result = ProjectDraft.create({
          ...validInput(),
          projectCategory: "RICE_FARMING",
        });
        expect(result.ok).toBe(true);
      });

      it("未定義カテゴリはエラー", () => {
        const result = ProjectDraft.create({
          ...validInput(),
          projectCategory: "NOT_A_CATEGORY",
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.type).toBe("INVALID_PROJECT_CATEGORY");
        }
      });
    });
  });

  describe("PROJECT_DRAFT_LIMITS", () => {
    it("仕様通りの上限値を持つ", () => {
      expect(PROJECT_DRAFT_LIMITS.projectTitle).toBe(100);
      expect(PROJECT_DRAFT_LIMITS.projectSummary).toBe(300);
      expect(PROJECT_DRAFT_LIMITS.projectStory).toBe(5000);
      expect(PROJECT_DRAFT_LIMITS.plannedActivities).toBe(1000);
    });
  });

  describe("equals", () => {
    it("同じ内容なら true", () => {
      const a = ProjectDraft.create(validInput());
      const b = ProjectDraft.create(validInput());
      expect(a.ok && b.ok && a.value.equals(b.value)).toBe(true);
    });

    it("title が違えば false", () => {
      const a = ProjectDraft.create(validInput());
      const b = ProjectDraft.create({
        ...validInput(),
        projectTitle: "別のタイトル",
      });
      expect(a.ok && b.ok && a.value.equals(b.value)).toBe(false);
    });
  });
});
