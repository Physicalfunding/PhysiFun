import type { MyLatestLeaderApplication } from "@physifun/application";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * Issue #374: 応募状況の表示のテスト。
 * HTML にして、審査中・却下・応募なしのそれぞれで出るもの・出ないものを確かめる。
 */

// 実行環境のタイムゾーンを UTC に固定する。応募日の表示で JST の指定が抜けたら、JST の開発機でも落ちるように。
// 表示部品は読み込み時に日付のフォーマッタを作るので、import より前（vi.hoisted）に設定する
const originalTz = vi.hoisted(() => {
  const tz = process.env.TZ;
  process.env.TZ = "UTC";
  return tz;
});
afterAll(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

import { ApplicationStatus } from "../ApplicationStatus";
const EMAIL = "leader@example.com";

const application: MyLatestLeaderApplication = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "PENDING",
  projectTitle: "里山の竹林を整備する",
  projectSummary: "放置された竹林を手入れして、\n地域の遊び場にします。",
  projectCategory: "NATURE",
  // JST では 2026-11-04 00:30（UTC のままだと 11 月 3 日になる）
  submittedAt: new Date("2026-11-03T15:30:00Z"),
  reviewerNote: null,
};

const rejected: MyLatestLeaderApplication = {
  ...application,
  status: "REJECTED",
  reviewerNote: "活動の場所と日程を具体的に書いてください。\n次回のご応募をお待ちしています。",
};

const render = (app: MyLatestLeaderApplication | null) =>
  renderToStaticMarkup(<ApplicationStatus email={EMAIL} application={app} />);

/** 「審査中」が「リーダー応募を審査中」の一部としてしか出てこないか（審査B と区別するため） */
const expectNoBareUnderReview = (html: string) => {
  expect(html.replaceAll("リーダー応募を審査中", "")).not.toContain("審査中");
};

/** 応募内容の控え（タイトル・概要・カテゴリ・応募日） */
const expectSummary = (html: string) => {
  expect(html).toContain("応募内容の控え");
  expect(html).toContain("里山の竹林を整備する");
  expect(html).toContain("放置された竹林を手入れして、\n地域の遊び場にします。");
  expect(html).toContain("農作業・キャンプ場（自然）");
  expect(html).toContain("2026年11月4日");
};

describe("ApplicationStatus", () => {
  describe("審査中", () => {
    it("見出し・プロジェクト案のタイトル・確認中であること・結果を送るメールアドレスを出す", () => {
      const html = render(application);
      expect(html).toContain('data-status="PENDING"');
      expect(html).toContain("リーダー応募を審査中です");
      expect(html).toContain("「里山の竹林を整備する」");
      expect(html).toContain("運営チームが内容を確認しています");
      expect(html).toContain(EMAIL);
      expect(html).toContain("にメールでお知らせします");
    });

    it("承認されたあとの流れ（下書きが用意される・公開の前にもう一度確認がある）を出す", () => {
      const html = render(application);
      expect(html).toContain("承認されたあとの流れ");
      expect(html).toContain("プロジェクトの下書きが用意されます");
      expect(html).toContain("公開の前にもう一度、運営チームが内容を確認します");
    });

    it("応募内容の控えを出す（応募日は JST の日付）", () => {
      expectSummary(render(application));
    });

    it("ボタンやリンクは出さない", () => {
      const html = render(application);
      expect(html).not.toContain("<button");
      expect(html).not.toContain("<a ");
    });

    it("「審査中」を単独で書かない", () => {
      expectNoBareUnderReview(render(application));
    });
  });

  describe("却下", () => {
    it("見出しと却下の理由を出す", () => {
      const html = render(rejected);
      expect(html).toContain('data-status="REJECTED"');
      expect(html).toContain("リーダー応募は承認されませんでした");
      expect(html).toContain("理由");
      expect(html).toContain(
        "活動の場所と日程を具体的に書いてください。\n次回のご応募をお待ちしています。"
      );
    });

    it("応募内容の控えを出す", () => {
      expectSummary(render(rejected));
    });

    it("「承認されたあとの流れ」とボタン（「もう一度応募する」は A-7 で足す）は出さない", () => {
      const html = render(rejected);
      expect(html).not.toContain("承認されたあとの流れ");
      expect(html).not.toContain("下書き");
      expect(html).not.toContain("<button");
      expect(html).not.toContain("<a ");
    });

    it("審査中の表示（見出し・メールのお知らせ）は出さない", () => {
      const html = render(rejected);
      expect(html).not.toContain("リーダー応募を審査中です");
      expect(html).not.toContain(EMAIL);
      expectNoBareUnderReview(html);
    });
  });

  describe("応募なし", () => {
    it("「応募はまだありません」と /apply への案内を出す", () => {
      const html = render(null);
      expect(html).toContain('data-status="NONE"');
      expect(html).toContain("応募はまだありません");
      expect(html).toContain('href="/apply"');
      expect(html).not.toContain("応募内容の控え");
      expectNoBareUnderReview(html);
    });

    it("リーダーでないのに最新の応募が承認済み（起きないはず）のときも「応募なし」と同じにする", () => {
      const html = render({ ...application, status: "APPROVED" });
      expect(html).toContain("応募はまだありません");
      expect(html).not.toContain("承認済み");
      expect(html).not.toContain("プロジェクトを始める");
      expect(html).not.toContain("里山の竹林を整備する");
    });
  });
});
