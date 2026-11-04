import type { MyLeaderApplicationStatusDTO } from "@physifun/application";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Issue #374: `/my/projects` ↔ `/my/application` の振り分けのテスト（設計書 §5.1）
 *
 * セッション・DI・`redirect` をモックし、ページ（Server Component）を直接呼ぶ。
 * - リーダーでない人が `/my/projects` を開くと `/my/application` へ移る
 * - リーダーが `/my/application` を開くと `/my/projects` へ移る
 * - 状態はセッションのアカウント ID で読む
 */

/** `redirect` は Next.js では例外を投げて描画を止めるので、同じく投げて行き先を確かめる */
class RedirectCalled extends Error {
  constructor(readonly url: string) {
    super(`redirect: ${url}`);
  }
}

const state = vi.hoisted(() => ({
  userId: null as string | null,
  status: null as MyLeaderApplicationStatusDTO | null,
  queriedAccountIds: [] as string[],
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectCalled(url);
  },
}));
vi.mock("@/lib/session", () => ({
  getCurrentUserId: async () => state.userId,
}));
vi.mock("@/lib/di/leader-application", () => ({
  getMyLeaderApplicationQueryService: () => ({
    findStatusByAccountId: async (accountId: string) => {
      state.queriedAccountIds.push(accountId);
      return state.status;
    },
  }),
}));
// 一覧はクライアントで API を読む部品なので、ここでは目印だけにする
vi.mock("@/components/my/projects/ProjectList", () => ({
  ProjectList: () => <div data-testid="project-list" />,
}));

import MyApplicationPage from "../application/page";
import MyProjectsPage from "../projects/page";

const ACCOUNT_ID = "00000000-0000-4000-a000-000000000001";

const pendingStatus: MyLeaderApplicationStatusDTO = {
  isLeader: false,
  email: "applicant@example.com",
  latestApplication: {
    id: "11111111-1111-4111-8111-111111111111",
    status: "PENDING",
    projectTitle: "里山の竹林を整備する",
    projectSummary: "放置された竹林を手入れします。",
    projectCategory: "NATURE",
    submittedAt: new Date("2026-11-03T03:00:00Z"),
    reviewerNote: null,
  },
};

const rejectedStatus: MyLeaderApplicationStatusDTO = {
  ...pendingStatus,
  latestApplication: {
    ...pendingStatus.latestApplication!,
    status: "REJECTED",
    reviewerNote: "活動の場所を具体的に書いてください。",
  },
};

const leaderStatus: MyLeaderApplicationStatusDTO = {
  isLeader: true,
  email: "leader@example.com",
  latestApplication: { ...pendingStatus.latestApplication!, status: "APPROVED" },
};

/** ページを呼び、redirect されたらその行き先を、されなければ HTML を返す */
async function open(page: () => Promise<React.ReactElement>) {
  try {
    return { html: renderToStaticMarkup(await page()), redirectedTo: null };
  } catch (e) {
    if (e instanceof RedirectCalled) return { html: null, redirectedTo: e.url };
    throw e;
  }
}

beforeEach(() => {
  state.userId = ACCOUNT_ID;
  state.status = null;
  state.queriedAccountIds = [];
});

describe("/my/projects", () => {
  it("リーダーには一覧を出す", async () => {
    state.status = leaderStatus;
    const { html, redirectedTo } = await open(MyProjectsPage);
    expect(redirectedTo).toBeNull();
    expect(html).toContain("マイプロジェクト");
    expect(html).toContain('data-testid="project-list"');
  });

  it("リーダー応募の審査中の人は /my/application へ移す", async () => {
    state.status = pendingStatus;
    expect((await open(MyProjectsPage)).redirectedTo).toBe("/my/application");
  });

  it("却下された人も /my/application へ移す", async () => {
    state.status = rejectedStatus;
    expect((await open(MyProjectsPage)).redirectedTo).toBe("/my/application");
  });

  it("リーダーなら、最新の応募が承認済みでなくても一覧を出す（ロールで決める）", async () => {
    state.status = { ...rejectedStatus, isLeader: true };
    const { html, redirectedTo } = await open(MyProjectsPage);
    expect(redirectedTo).toBeNull();
    expect(html).toContain('data-testid="project-list"');
  });

  it("リーダーでなければ、最新の応募が承認済み（起きないはず）でも /my/application へ移す", async () => {
    state.status = { ...leaderStatus, isLeader: false };
    expect((await open(MyProjectsPage)).redirectedTo).toBe("/my/application");
  });

  it("応募が無い人・アカウントが見つからない人も /my/application へ移す", async () => {
    state.status = { isLeader: false, email: "x@example.com", latestApplication: null };
    expect((await open(MyProjectsPage)).redirectedTo).toBe("/my/application");
    state.status = null;
    expect((await open(MyProjectsPage)).redirectedTo).toBe("/my/application");
  });

  it("状態はセッションのアカウント ID で読む", async () => {
    state.status = leaderStatus;
    await open(MyProjectsPage);
    expect(state.queriedAccountIds).toEqual([ACCOUNT_ID]);
  });

  it("未ログインならログインへ移し、DB は読まない", async () => {
    state.userId = null;
    expect((await open(MyProjectsPage)).redirectedTo).toBe("/login?callbackUrl=%2Fmy%2Fprojects");
    expect(state.queriedAccountIds).toEqual([]);
  });
});

describe("/my/application", () => {
  it("リーダーは /my/projects へ移す", async () => {
    state.status = leaderStatus;
    expect((await open(MyApplicationPage)).redirectedTo).toBe("/my/projects");
  });

  it("審査中の人には、審査中の表示とアカウントのメールアドレスを出す", async () => {
    state.status = pendingStatus;
    const { html, redirectedTo } = await open(MyApplicationPage);
    expect(redirectedTo).toBeNull();
    expect(html).toContain("リーダー応募を審査中です");
    expect(html).toContain("applicant@example.com");
  });

  it("却下された人には、却下の表示と理由を出す", async () => {
    state.status = rejectedStatus;
    const { html } = await open(MyApplicationPage);
    expect(html).toContain("リーダー応募は承認されませんでした");
    expect(html).toContain("活動の場所を具体的に書いてください。");
  });

  it("リーダーなら、最新の応募が却下でも /my/projects へ移す（ロールで決める）", async () => {
    state.status = { ...rejectedStatus, isLeader: true };
    expect((await open(MyApplicationPage)).redirectedTo).toBe("/my/projects");
  });

  it("リーダーでないのに最新の応募が承認済み（起きないはず）なら、移さずに「応募なし」を出す（移し合いにならない）", async () => {
    state.status = { ...leaderStatus, isLeader: false };
    const { html, redirectedTo } = await open(MyApplicationPage);
    expect(redirectedTo).toBeNull();
    expect(html).toContain("応募はまだありません");
  });

  it("アカウントが見つからないときは「応募なし」を出す", async () => {
    state.status = null;
    const { html, redirectedTo } = await open(MyApplicationPage);
    expect(redirectedTo).toBeNull();
    expect(html).toContain("応募はまだありません");
  });

  it("状態はセッションのアカウント ID で読む", async () => {
    state.status = pendingStatus;
    await open(MyApplicationPage);
    expect(state.queriedAccountIds).toEqual([ACCOUNT_ID]);
  });

  it("未ログインならログインへ移し、DB は読まない", async () => {
    state.userId = null;
    expect((await open(MyApplicationPage)).redirectedTo).toBe(
      "/login?callbackUrl=%2Fmy%2Fapplication"
    );
    expect(state.queriedAccountIds).toEqual([]);
  });
});
