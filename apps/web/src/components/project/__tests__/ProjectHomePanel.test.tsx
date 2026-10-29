import type { ProjectStoryDocument } from "@physifun/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProjectHomePanel } from "../ProjectHomePanel";

/**
 * Issue #316: 「ホーム」タブの中身（公開ページ・マイページで共有）のテスト。
 * HTML にして、2 列の並び・右の列の中身・SNS の統合を確かめる。
 */
const story: ProjectStoryDocument = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "ストーリー本文です" }] }],
};

const leader = { displayName: "山田 花子", bio: "アカウントの bio" };

const render = (props: Partial<Parameters<typeof ProjectHomePanel>[0]> = {}) =>
  renderToStaticMarkup(
    <ProjectHomePanel
      body={story}
      leaderIntroduction="大工をしています"
      leader={leader}
      snsLinks={{ x: "https://x.com/foo", instagram: null, facebook: null, website: null }}
      activityPlan="11 月は片付け"
      {...props}
    />
  );

describe("ProjectHomePanel", () => {
  it("PC は 2 列（左 2 : 右 1）で、スマホは 1 列になる grid にする", () => {
    const html = render();
    expect(html).toContain("grid gap-6 lg:grid-cols-3");
    expect(html).toContain("lg:col-span-2");
  });

  it("左の列に見出し「ストーリー」で本文を出す", () => {
    const html = render();
    expect(html).toContain("ストーリー</h3>");
    expect(html).toContain("ストーリー本文です");
    expect(html).not.toContain("プロジェクト詳細");
  });

  it("右の列にリーダー紹介（頭文字・名前・紹介文・SNS）→ 活動計画 →「サポート募集を見る」の順で並ぶ", () => {
    const html = render();
    // 見出しは </h3> まで含めて探す（aside の aria-label にも同じ語があるため）
    const order = [
      "リーダー紹介</h3>",
      "山",
      "山田 花子",
      "大工をしています",
      "X (Twitter)",
      "活動計画</h3>",
      "11 月は片付け",
      "サポート募集を見る",
    ];
    const positions = order.map((s) => html.indexOf(s));
    positions.forEach((pos, i) => {
      expect(pos, `${order[i]} が無い`).toBeGreaterThanOrEqual(0);
      if (i > 0) expect(pos, `${order[i]} の位置`).toBeGreaterThan(positions[i - 1]);
    });
  });

  it("SNS は独立したカードではなく、リーダー紹介のカードの中に出す", () => {
    const html = render();
    expect(html).not.toContain("SNS / ウェブサイト</h3>");
    expect(html).toContain('href="https://x.com/foo"');
  });

  it("リーダー紹介が空のときはアカウントの bio を出し、両方あれば紹介文だけを出す", () => {
    expect(render({ leaderIntroduction: null })).toContain("アカウントの bio");
    expect(render()).not.toContain("アカウントの bio");
  });

  it("活動計画が空ならそのカードを出さず、SNS が空ならリンクの一覧を出さない", () => {
    const html = render({ activityPlan: null, snsLinks: null });
    expect(html).not.toContain("活動計画</h3>");
    expect(html).not.toContain("<ul");
  });

  it("本文が無いときは emptyState を出す", () => {
    const html = render({ body: null, emptyState: <p>まだコンテンツがありません</p> });
    expect(html).toContain("まだコンテンツがありません");
    expect(html).not.toContain("ストーリー</h3>");
  });
});
