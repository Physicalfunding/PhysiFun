import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  AccountId,
  ProjectId,
  RecruitmentType,
  type Result,
  SupportRecruitment,
  SupportRecruitmentId,
} from "@physifun/domain";
import type { RecruitmentPort } from "@/lib/di/recruitment";

/**
 * 募集 API の Route Handler のテスト（#218）
 *
 * - セッション・DI・レート制限をモックし、ユースケースは本物を使う（認可が 2 段目のユースケースで効くことまで見る）
 * - 主に認可（未ログインは 401、他人のプロジェクトの募集は 403）と、入力の検証を確かめる
 */

const state = vi.hoisted(() => ({
  userId: null as string | null,
  port: undefined as FakeRecruitmentPort | undefined,
}));

vi.mock("@/lib/session", () => ({
  getCurrentUserId: async () => state.userId,
}));
vi.mock("@/lib/di/recruitment", () => ({
  getRecruitmentPort: () => state.port,
}));
vi.mock("@/lib/rateLimit", () => ({
  enforceRateLimit: async () => null,
}));

import { GET, POST } from "../projects/[projectId]/recruitments/route";
import { PATCH, DELETE } from "../recruitments/[recruitmentId]/route";

const OWNER_ID = "00000000-0000-4000-a000-000000000001";
const OTHER_ID = "00000000-0000-4000-a000-000000000002";
const PROJECT_ID = "00000000-0000-4000-b000-000000000001";
const RECRUITMENT_ID = "00000000-0000-4000-8000-000000000001";
const MISSING_ID = "00000000-0000-4000-8000-0000000000ff";

function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`fixture broken: ${JSON.stringify(result.error)}`);
  return result.value;
}

/** 書き込みを配列に反映するだけのインメモリ実装 */
class FakeRecruitmentPort implements RecruitmentPort {
  /** プロジェクト ID → 所有者のアカウント ID */
  owners = new Map<string, string>([[PROJECT_ID, OWNER_ID]]);
  recruitments: SupportRecruitment[] = [];

  async findProjectOwner(id: ProjectId) {
    const owner = this.owners.get(id.toString());
    return owner ? unwrap(AccountId.from(owner)) : null;
  }
  async findById(id: SupportRecruitmentId) {
    return this.recruitments.find((r) => r.id.equals(id)) ?? null;
  }
  async findByProjectId(id: ProjectId) {
    return this.recruitments.filter((r) => r.projectId.equals(id));
  }
  async create(recruitment: SupportRecruitment) {
    this.recruitments.push(recruitment);
  }
  async update(recruitment: SupportRecruitment) {
    this.recruitments = this.recruitments.map((r) =>
      r.id.equals(recruitment.id) ? recruitment : r
    );
  }
  async delete(id: SupportRecruitmentId) {
    this.recruitments = this.recruitments.filter((r) => !r.id.equals(id));
  }
}

function createRecruitment(): SupportRecruitment {
  return unwrap(
    SupportRecruitment.create({
      id: unwrap(SupportRecruitmentId.from(RECRUITMENT_ID)),
      projectId: unwrap(ProjectId.from(PROJECT_ID)),
      type: RecruitmentType.ACTIVITY,
      title: "畑の草刈り",
      description: "一緒に草刈りをしてくれる人を募集します",
    })
  );
}

function jsonRequest(method: string, body: unknown): Request {
  return new Request("http://localhost/api", {
    method,
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const projectParams = { params: Promise.resolve({ projectId: PROJECT_ID }) };
const recruitmentParams = (recruitmentId = RECRUITMENT_ID) => ({
  params: Promise.resolve({ recruitmentId }),
});

describe("募集 API", () => {
  let port: FakeRecruitmentPort;

  beforeEach(() => {
    port = new FakeRecruitmentPort();
    port.recruitments.push(createRecruitment());
    state.port = port;
    state.userId = OWNER_ID;
  });

  describe("未ログイン", () => {
    beforeEach(() => {
      state.userId = null;
    });

    it.each([
      ["GET 一覧", () => GET(new Request("http://localhost/api"), projectParams)],
      [
        "POST 作成",
        () => POST(jsonRequest("POST", { title: "a", description: "b" }), projectParams),
      ],
      ["PATCH 更新", () => PATCH(jsonRequest("PATCH", { title: "a" }), recruitmentParams())],
      ["DELETE 削除", () => DELETE(new Request("http://localhost/api"), recruitmentParams())],
    ])("%s は 401", async (_name, call) => {
      const response = await call();
      expect(response.status).toBe(401);
    });
  });

  describe("他人のプロジェクトの募集", () => {
    beforeEach(() => {
      state.userId = OTHER_ID;
    });

    it.each([
      ["GET 一覧", () => GET(new Request("http://localhost/api"), projectParams)],
      [
        "POST 作成",
        () => POST(jsonRequest("POST", { title: "a", description: "b" }), projectParams),
      ],
      ["PATCH 更新", () => PATCH(jsonRequest("PATCH", { title: "a" }), recruitmentParams())],
      ["DELETE 削除", () => DELETE(new Request("http://localhost/api"), recruitmentParams())],
    ])("%s は 403 で、募集は変わらない", async (_name, call) => {
      const response = await call();

      expect(response.status).toBe(403);
      expect(port.recruitments).toHaveLength(1);
      expect(port.recruitments[0].title).toBe("畑の草刈り");
    });
  });

  describe("GET /api/my/projects/[projectId]/recruitments", () => {
    it("所有者には募集の一覧を返す", async () => {
      const response = await GET(new Request("http://localhost/api"), projectParams);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.recruitments).toEqual([
        {
          id: RECRUITMENT_ID,
          type: "ACTIVITY",
          title: "畑の草刈り",
          description: "一緒に草刈りをしてくれる人を募集します",
          schedules: [],
        },
      ]);
    });

    it("プロジェクトが無ければ 404", async () => {
      const response = await GET(new Request("http://localhost/api"), {
        params: Promise.resolve({ projectId: MISSING_ID }),
      });
      expect(response.status).toBe(404);
    });
  });

  describe("POST /api/my/projects/[projectId]/recruitments", () => {
    it("所有者は 201 で募集を作れる（前後の空白は除く）", async () => {
      const response = await POST(
        jsonRequest("POST", { title: "  収穫の手伝い  ", description: "芋掘り" }),
        projectParams
      );

      expect(response.status).toBe(201);
      const json = await response.json();
      const created = port.recruitments.find((r) => r.id.toString() === json.data.recruitmentId);
      expect(created?.title).toBe("収穫の手伝い");
    });

    it("タイトルが空白だけなら 400 で、項目ごとのメッセージを返す", async () => {
      const response = await POST(
        jsonRequest("POST", { title: "   ", description: "芋掘り" }),
        projectParams
      );

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error.fields.title).toEqual(["タイトルは必須です"]);
      expect(port.recruitments).toHaveLength(1);
    });

    it("JSON として読めない本文は 400", async () => {
      const response = await POST(jsonRequest("POST", "{"), projectParams);
      expect(response.status).toBe(400);
    });
  });

  describe("PATCH /api/my/recruitments/[recruitmentId]", () => {
    it("所有者は指定した項目だけ更新できる", async () => {
      const response = await PATCH(
        jsonRequest("PATCH", { title: "畑の水やり" }),
        recruitmentParams()
      );

      expect(response.status).toBe(200);
      expect(port.recruitments[0].title).toBe("畑の水やり");
      expect(port.recruitments[0].description).toBe("一緒に草刈りをしてくれる人を募集します");
    });

    it("募集が無ければ 404", async () => {
      const response = await PATCH(
        jsonRequest("PATCH", { title: "畑の水やり" }),
        recruitmentParams(MISSING_ID)
      );
      expect(response.status).toBe(404);
    });

    it("ID の形式が不正なら 400", async () => {
      const response = await PATCH(
        jsonRequest("PATCH", { title: "畑の水やり" }),
        recruitmentParams("not-a-uuid")
      );
      expect(response.status).toBe(400);
    });
  });

  describe("DELETE /api/my/recruitments/[recruitmentId]", () => {
    it("所有者は募集を削除できる", async () => {
      const response = await DELETE(new Request("http://localhost/api"), recruitmentParams());

      expect(response.status).toBe(200);
      expect(port.recruitments).toHaveLength(0);
    });
  });
});
