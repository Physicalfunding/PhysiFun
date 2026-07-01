/**
 * ApplyForm の Zod スキーマ単体テスト
 *
 * フロント側 `applyFormSchema` の以下を担保する。
 * - 条件付き必須（superRefine）: TIME / SKILL_ITEM 選択時の必須項目
 * - experienceOffered の trim 検証（半角スペースのみで弾く）
 * - recruitCount の上限 (LEADER_APPLICATION_LIMITS.recruitCountMax)
 */
import { describe, expect, it } from "@jest/globals";
import { LEADER_APPLICATION_LIMITS } from "@physifun/domain";
import { applyFormSchema } from "../ApplyForm";

type RawInput = Record<string, unknown>;

/**
 * 条件付き必須を満たさない最低限の有効入力（recruitmentTypes は空配列を上書きする想定）
 */
function baseValidInput(overrides: RawInput = {}): RawInput {
  return {
    displayName: "テストユーザー",
    email: "test@example.com",
    projectTitle: "古民家を再生するプロジェクト",
    projectSummary: "地域の古民家を若者の交流拠点として再生します。",
    projectStory: "過疎化が進む地域の古民家を活用し、若者が集まれる場所を作ります。",
    projectCategory: "FOOD",
    progress: "PLANNING",
    recruitmentTypes: ["TIME"],
    activityContent: "月に 2 回のワークショップを開催し、DIY で改修を進めます。",
    eventLocation: "京都市内の現地",
    eventPeriod: "2026年4月〜2026年12月",
    recruitCount: 10,
    timeReturn: "活動証明書と地元食材を返礼します。",
    experienceOffered: "古民家再生の体験を提供します。",
    prefectureCode: "26",
    agreeTerms: true,
    ...overrides,
  };
}

describe("applyFormSchema", () => {
  describe("ハッピーパス", () => {
    it("TIME のみ選択時、必須一式が揃っていれば valid", () => {
      const result = applyFormSchema.safeParse(baseValidInput());
      expect(result.success).toBe(true);
    });

    it("SKILL_ITEM のみ選択時、必須一式が揃っていれば valid", () => {
      const input = baseValidInput({
        recruitmentTypes: ["SKILL_ITEM"],
        // TIME 必須項目は不要
        activityContent: undefined,
        eventLocation: undefined,
        eventPeriod: undefined,
        recruitCount: undefined,
        timeReturn: undefined,
        // SKILL_ITEM 必須項目
        skillItemNeeds: "建築 DIY スキルをお持ちの方",
        skillItemDeadline: "2026年7月末まで",
        skillItemReturn: "現地ツアーへご招待します。",
      });
      const result = applyFormSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("TIME と SKILL_ITEM の両方を選択した場合、両方の必須が揃っていれば valid", () => {
      const input = baseValidInput({
        recruitmentTypes: ["TIME", "SKILL_ITEM"],
        skillItemNeeds: "建築 DIY スキルをお持ちの方",
        skillItemDeadline: "2026年7月末まで",
        skillItemReturn: "現地ツアーへご招待します。",
      });
      const result = applyFormSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe("条件付き必須（TIME）", () => {
    it("TIME 選択時に activityContent が未入力ならエラー", () => {
      const input = baseValidInput({ activityContent: "" });
      const result = applyFormSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.issues.some((i) => i.path[0] === "activityContent")).toBe(true);
    });

    it("TIME 選択時に recruitCount が NaN（未入力）ならエラー", () => {
      const input = baseValidInput({ recruitCount: Number.NaN });
      const result = applyFormSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.issues.some((i) => i.path[0] === "recruitCount")).toBe(true);
    });

    it("TIME 選択時に eventLocation が空白のみなら trim でエラー", () => {
      const input = baseValidInput({ eventLocation: "   " });
      const result = applyFormSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.issues.some((i) => i.path[0] === "eventLocation")).toBe(true);
    });
  });

  describe("条件付き必須（SKILL_ITEM）", () => {
    it("SKILL_ITEM 選択時に skillItemNeeds が未入力ならエラー", () => {
      const input = baseValidInput({
        recruitmentTypes: ["SKILL_ITEM"],
        activityContent: undefined,
        eventLocation: undefined,
        eventPeriod: undefined,
        recruitCount: undefined,
        timeReturn: undefined,
        // skillItemNeeds は意図的に未入力
        skillItemDeadline: "2026年7月末まで",
        skillItemReturn: "現地ツアーへご招待します。",
      });
      const result = applyFormSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.issues.some((i) => i.path[0] === "skillItemNeeds")).toBe(true);
    });
  });

  describe("experienceOffered の trim 検証", () => {
    it("半角スペースのみの入力は弾かれる", () => {
      const input = baseValidInput({ experienceOffered: "     " });
      const result = applyFormSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.issues.some((i) => i.path[0] === "experienceOffered")).toBe(true);
    });

    it("前後にスペースがある入力は trim されてから保存される", () => {
      const input = baseValidInput({ experienceOffered: "  古民家再生の体験。  " });
      const result = applyFormSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.experienceOffered).toBe("古民家再生の体験。");
    });
  });

  describe("recruitCount の上限", () => {
    it("recruitCountMax を超える値はエラー", () => {
      const input = baseValidInput({
        recruitCount: LEADER_APPLICATION_LIMITS.recruitCountMax + 1,
      });
      const result = applyFormSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.issues.some((i) => i.path[0] === "recruitCount")).toBe(true);
    });

    it("recruitCountMax と等しい値は許可される", () => {
      const input = baseValidInput({
        recruitCount: LEADER_APPLICATION_LIMITS.recruitCountMax,
      });
      const result = applyFormSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });
});
