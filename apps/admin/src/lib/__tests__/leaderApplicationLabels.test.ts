/**
 * apps/admin リーダー応募ラベル変換の単体テスト (Issue #192 PR6 レビュー対応 M4)
 *
 * 募集タイプ・ProjectPhase の表示ラベル変換、および
 * `recruitmentTypes` 空配列ケースなどの分岐を回帰テストとして残す。
 *
 * 実行: `bun test apps/admin/src/lib/__tests__/leaderApplicationLabels.test.ts`
 */
import { describe, test, expect } from "bun:test";
import {
  isLeaderApplicationRecruitmentType,
  isProjectPhase,
  LEADER_APPLICATION_RECRUITMENT_TYPE_LABELS,
  LeaderApplicationRecruitmentType,
  PROJECT_PHASE_LABELS,
  ProjectPhase,
} from "@physifun/domain";
import { getRecruitmentTypeLabel } from "../leaderApplicationLabels";

describe("getRecruitmentTypeLabel", () => {
  test("TIME を「時間（やる気）での支援」に変換する", () => {
    expect(getRecruitmentTypeLabel(LeaderApplicationRecruitmentType.TIME)).toBe(
      "時間（やる気）での支援"
    );
  });

  test("SKILL_ITEM を「スキル・モノでの支援」に変換する", () => {
    expect(getRecruitmentTypeLabel(LeaderApplicationRecruitmentType.SKILL_ITEM)).toBe(
      "スキル・モノでの支援"
    );
  });

  test("SSOT として domain 側のラベル定義と一致する", () => {
    expect(getRecruitmentTypeLabel(LeaderApplicationRecruitmentType.TIME)).toBe(
      LEADER_APPLICATION_RECRUITMENT_TYPE_LABELS[LeaderApplicationRecruitmentType.TIME]
    );
    expect(getRecruitmentTypeLabel(LeaderApplicationRecruitmentType.SKILL_ITEM)).toBe(
      LEADER_APPLICATION_RECRUITMENT_TYPE_LABELS[LeaderApplicationRecruitmentType.SKILL_ITEM]
    );
  });
});

describe("isLeaderApplicationRecruitmentType", () => {
  test("TIME / SKILL_ITEM は true を返す", () => {
    expect(isLeaderApplicationRecruitmentType("TIME")).toBe(true);
    expect(isLeaderApplicationRecruitmentType("SKILL_ITEM")).toBe(true);
  });

  test("未知の値は false を返す", () => {
    expect(isLeaderApplicationRecruitmentType("OTHER")).toBe(false);
    expect(isLeaderApplicationRecruitmentType("")).toBe(false);
    expect(isLeaderApplicationRecruitmentType("time")).toBe(false);
  });

  test("filter で空配列に対しても安全に動作する", () => {
    const empty: string[] = [];
    expect(empty.filter(isLeaderApplicationRecruitmentType)).toEqual([]);
  });

  test("不正値混入時は黙ってフィルタ除外する", () => {
    const mixed: string[] = ["TIME", "INVALID", "SKILL_ITEM"];
    expect(mixed.filter(isLeaderApplicationRecruitmentType)).toEqual(["TIME", "SKILL_ITEM"]);
  });
});

describe("isProjectPhase", () => {
  test("VISION / PLANNING / READY / EXECUTION / ONGOING は true を返す", () => {
    expect(isProjectPhase("VISION")).toBe(true);
    expect(isProjectPhase("PLANNING")).toBe(true);
    expect(isProjectPhase("READY")).toBe(true);
    expect(isProjectPhase("EXECUTION")).toBe(true);
    expect(isProjectPhase("ONGOING")).toBe(true);
  });

  test("未知の値は false を返す", () => {
    expect(isProjectPhase("UNKNOWN")).toBe(false);
    expect(isProjectPhase("")).toBe(false);
    expect(isProjectPhase("planning")).toBe(false);
  });
});

describe("PROJECT_PHASE_LABELS", () => {
  test("各 ProjectPhase が日本語ラベルにマッピングされる", () => {
    expect(PROJECT_PHASE_LABELS[ProjectPhase.VISION]).toBe("構想段階");
    expect(PROJECT_PHASE_LABELS[ProjectPhase.PLANNING]).toBe("準備中（企画・調整中）");
    expect(PROJECT_PHASE_LABELS[ProjectPhase.READY]).toBe("実行直前（準備ほぼ完了）");
    expect(PROJECT_PHASE_LABELS[ProjectPhase.EXECUTION]).toBe("実行中");
    expect(PROJECT_PHASE_LABELS[ProjectPhase.ONGOING]).toBe("一部完了（継続中）");
  });
});
