import { describe, expect, it } from "@jest/globals";
import { PROJECT_DRAFT_LIMITS, ProjectDraft } from "../value-objects/ProjectDraft";
import { ProjectLocation } from "../../shared/value-objects/ProjectLocation";
import { SnsLinks } from "../../shared/value-objects/SnsLinks";

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
    projectStory: "# 想い\n古民家に込められた歴史を次世代に繋ぎたい",
    projectCategory: "KOMINKA",
    location: validLocation(),
    activityContent: "週末 DIY イベント、解体作業、清掃活動",
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

      it("60 文字ちょうどは OK", () => {
        const result = ProjectDraft.create({
          ...validInput(),
          projectTitle: "あ".repeat(60),
        });
        expect(result.ok).toBe(true);
      });

      it("61 文字はエラー", () => {
        const result = ProjectDraft.create({
          ...validInput(),
          projectTitle: "あ".repeat(61),
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.type).toBe("TEXT_TOO_LONG");
          if (result.error.type === "TEXT_TOO_LONG") {
            expect(result.error.field).toBe("projectTitle");
            expect(result.error.maxLength).toBe(60);
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

      it("150 文字ちょうどは OK", () => {
        const result = ProjectDraft.create({
          ...validInput(),
          projectSummary: "a".repeat(150),
        });
        expect(result.ok).toBe(true);
      });

      it("151 文字はエラー", () => {
        const result = ProjectDraft.create({
          ...validInput(),
          projectSummary: "a".repeat(151),
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

      it("300 文字ちょうどは OK", () => {
        const result = ProjectDraft.create({
          ...validInput(),
          projectStory: "a".repeat(300),
        });
        expect(result.ok).toBe(true);
      });

      it("301 文字はエラー", () => {
        const result = ProjectDraft.create({
          ...validInput(),
          projectStory: "a".repeat(301),
        });
        expect(result.ok).toBe(false);
      });
    });

    describe("activityContent", () => {
      it("未指定（undefined）でも OK（条件付き必須は呼び出し側で担保）", () => {
        const result = ProjectDraft.create({
          ...validInput(),
          activityContent: undefined,
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.activityContent).toBeNull();
        }
      });

      it("null でも OK", () => {
        const result = ProjectDraft.create({
          ...validInput(),
          activityContent: null,
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.activityContent).toBeNull();
        }
      });

      it("空文字（トリム後空）は null になる", () => {
        const result = ProjectDraft.create({
          ...validInput(),
          activityContent: "   ",
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.activityContent).toBeNull();
        }
      });

      it("200 文字ちょうどは OK", () => {
        const result = ProjectDraft.create({
          ...validInput(),
          activityContent: "a".repeat(200),
        });
        expect(result.ok).toBe(true);
      });

      it("201 文字はエラー", () => {
        const result = ProjectDraft.create({
          ...validInput(),
          activityContent: "a".repeat(201),
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.type).toBe("TEXT_TOO_LONG");
          if (result.error.type === "TEXT_TOO_LONG") {
            expect(result.error.field).toBe("activityContent");
            expect(result.error.maxLength).toBe(200);
          }
        }
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
    it("仕様通りの上限値を持つ（Issue #192 PR3 改訂後の仮値）", () => {
      expect(PROJECT_DRAFT_LIMITS.projectTitle).toBe(60);
      expect(PROJECT_DRAFT_LIMITS.projectSummary).toBe(150);
      expect(PROJECT_DRAFT_LIMITS.projectStory).toBe(300);
      expect(PROJECT_DRAFT_LIMITS.activityContent).toBe(200);
    });

    it("plannedActivities は activityContent の後方互換別名として併存する", () => {
      // PR4 で UI が再編されたタイミングで削除予定
      expect(PROJECT_DRAFT_LIMITS.plannedActivities).toBe(PROJECT_DRAFT_LIMITS.activityContent);
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
