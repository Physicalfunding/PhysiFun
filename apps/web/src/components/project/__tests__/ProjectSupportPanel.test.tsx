import type { RecruitmentDTO } from "@physifun/application";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProjectSupportPanel } from "../ProjectSupportPanel";

/**
 * Issue #219: 公開ページ「サポート募集」タブの中身のテスト。
 * HTML にして、募集と日程の表示・募集が無いとき・申請ボタンが無いことを確かめる。
 */
const recruitment: RecruitmentDTO = {
  id: "11111111-1111-4111-8111-111111111111",
  type: "ACTIVITY",
  title: "畑の草刈り",
  description: "一緒に草刈りをしてくれる人を募集します。\n軍手は用意します。",
  schedules: [
    {
      id: "22222222-2222-4222-8222-222222222221",
      date: "2026-11-03",
      startTime: "10:00",
      endTime: "15:00",
      capacityPerHour: 5,
      approvalMode: "AUTO",
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      date: "2026-11-10",
      startTime: "09:00",
      endTime: "12:00",
      capacityPerHour: 3,
      approvalMode: "MANUAL",
    },
  ],
};

const render = (recruitments: readonly RecruitmentDTO[]) =>
  renderToStaticMarkup(<ProjectSupportPanel recruitments={recruitments} />);

describe("ProjectSupportPanel", () => {
  it("募集のタイトル・説明と、各日程の日付・時間帯・定員・承認モードを出す", () => {
    const html = render([recruitment]);
    expect(html).toContain("畑の草刈り");
    expect(html).toContain("一緒に草刈りをしてくれる人を募集します。");
    expect(html).toContain("2026年11月3日（火）");
    expect(html).toContain("10:00〜15:00");
    expect(html).toContain("1 時間 5 人まで");
    expect(html).toContain("自動承認");
    expect(html).toContain("2026年11月10日（火）");
    expect(html).toContain("09:00〜12:00");
    expect(html).toContain("1 時間 3 人まで");
    expect(html).toContain("手動承認");
  });

  it("日程は渡された順（日付の古い順）に並ぶ", () => {
    const html = render([recruitment]);
    expect(html.indexOf("2026年11月3日")).toBeLessThan(html.indexOf("2026年11月10日"));
  });

  it("申請ボタンは出さない（申請は一般公開で実装する）", () => {
    const html = render([recruitment]);
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("申請");
  });

  it("募集が無いときは「現在、サポート募集はありません」を出す", () => {
    const html = render([]);
    expect(html).toContain("現在、サポート募集はありません");
    expect(html).not.toContain("日程</h3>");
  });

  it("日程の無い募集は「日程はまだ決まっていません」を出す", () => {
    const html = render([{ ...recruitment, schedules: [] }]);
    expect(html).toContain("畑の草刈り");
    expect(html).toContain("日程はまだ決まっていません");
    expect(html).not.toContain("<ul");
  });
});
