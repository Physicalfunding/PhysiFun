import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  AccountId,
  ApprovalMode,
  CapacityPerHour,
  ProjectId,
  RecruitmentType,
  type Result,
  ScheduleDate,
  SupportRecruitment,
  SupportRecruitmentId,
  TimeRange,
} from "@physifun/domain";
import type { RecruitmentPort } from "@/lib/di/recruitment";

/**
 * 募集・日程 API の Route Handler のテスト（#218）
 *
 * - セッション・DI・レート制限をモックし、ユースケースは本物を使う（認可が 2 段目のユースケースで効くことまで見る）
 * - 主に認可（未ログインは 401、他人のプロジェクトの募集・日程は 403）と、入力の検証を確かめる
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
import { POST as POST_SCHEDULE } from "../recruitments/[recruitmentId]/schedules/route";
import {
  PATCH as PATCH_SCHEDULE,
  DELETE as DELETE_SCHEDULE,
} from "../recruitments/[recruitmentId]/schedules/[scheduleId]/route";

const OWNER_ID = "00000000-0000-4000-a000-000000000001";
const OTHER_ID = "00000000-0000-4000-a000-000000000002";
const PROJECT_ID = "00000000-0000-4000-b000-000000000001";
const OTHER_PROJECT_ID = "00000000-0000-4000-b000-000000000002";
const RECRUITMENT_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_RECRUITMENT_ID = "00000000-0000-4000-8000-000000000002";
const MISSING_ID = "00000000-0000-4000-8000-0000000000ff";

/** どの募集にも最初からある日程の日付（過去の日付の判定に引っかからない先の日付） */
const SCHEDULE_DATE = "2099-04-01";

function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`fixture broken: ${JSON.stringify(result.error)}`);
  return result.value;
}

/** 書き込みを配列に反映するだけのインメモリ実装 */
class FakeRecruitmentPort implements RecruitmentPort {
  /** プロジェクト ID → 所有者のアカウント ID */
  owners = new Map<string, string>([
    [PROJECT_ID, OWNER_ID],
    [OTHER_PROJECT_ID, OTHER_ID],
  ]);
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
  // 日程は、ユースケースが集約ルート（findById で返した recruitments の要素）のメソッドで
  // 追加・変更・削除した時点で反映されているので、ここでは何もしない
  async addSchedule() {}
  async updateSchedule() {}
  async removeSchedule() {}
}

/** 日程を 1 つ（SCHEDULE_DATE の 10:00〜12:00、定員 5 人、自動承認）持った募集を作る */
function createRecruitment(id = RECRUITMENT_ID, projectId = PROJECT_ID): SupportRecruitment {
  const recruitment = unwrap(
    SupportRecruitment.create({
      id: unwrap(SupportRecruitmentId.from(id)),
      projectId: unwrap(ProjectId.from(projectId)),
      type: RecruitmentType.ACTIVITY,
      title: "畑の草刈り",
      description: "一緒に草刈りをしてくれる人を募集します",
    })
  );
  unwrap(
    recruitment.addSchedule({
      date: unwrap(ScheduleDate.from(SCHEDULE_DATE)),
      timeRange: unwrap(TimeRange.create({ start: "10:00", end: "12:00" })),
      capacityPerHour: unwrap(CapacityPerHour.from(5)),
      approvalMode: ApprovalMode.AUTO,
    })
  );
  return recruitment;
}

/** 日程の入力（追加 API の本文） */
const scheduleBody = {
  date: "2099-05-01",
  startTime: "09:00",
  endTime: "15:00",
  capacityPerHour: 3,
  approvalMode: "MANUAL",
};

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

describe("募集・日程 API", () => {
  let port: FakeRecruitmentPort;

  /** 募集が最初から持っている日程 */
  const existingSchedule = (recruitmentId = RECRUITMENT_ID) => {
    const recruitment = port.recruitments.find((r) => r.id.toString() === recruitmentId);
    const schedule = recruitment?.schedules[0];
    if (!schedule) throw new Error("fixture broken: schedule not found");
    return schedule;
  };
  const scheduleParams = (
    recruitmentId = RECRUITMENT_ID,
    scheduleId = existingSchedule().id.toString()
  ) => ({
    params: Promise.resolve({ recruitmentId, scheduleId }),
  });

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
      [
        "POST 日程の追加",
        () => POST_SCHEDULE(jsonRequest("POST", scheduleBody), recruitmentParams()),
      ],
      [
        "PATCH 日程の更新",
        () => PATCH_SCHEDULE(jsonRequest("PATCH", { capacityPerHour: 9 }), scheduleParams()),
      ],
      [
        "DELETE 日程の削除",
        () => DELETE_SCHEDULE(new Request("http://localhost/api"), scheduleParams()),
      ],
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
      [
        "POST 日程の追加",
        () => POST_SCHEDULE(jsonRequest("POST", scheduleBody), recruitmentParams()),
      ],
      [
        "PATCH 日程の更新",
        () => PATCH_SCHEDULE(jsonRequest("PATCH", { capacityPerHour: 9 }), scheduleParams()),
      ],
      [
        "DELETE 日程の削除",
        () => DELETE_SCHEDULE(new Request("http://localhost/api"), scheduleParams()),
      ],
    ])("%s は 403 で、募集と日程は変わらない", async (_name, call) => {
      const response = await call();

      expect(response.status).toBe(403);
      expect(port.recruitments).toHaveLength(1);
      expect(port.recruitments[0].title).toBe("畑の草刈り");
      expect(port.recruitments[0].schedules).toHaveLength(1);
      expect(existingSchedule().capacityPerHour.value).toBe(5);
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
          schedules: [
            {
              id: existingSchedule().id.toString(),
              date: SCHEDULE_DATE,
              startTime: "10:00",
              endTime: "12:00",
              capacityPerHour: 5,
              approvalMode: "AUTO",
            },
          ],
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

  describe("POST /api/my/recruitments/[recruitmentId]/schedules", () => {
    it("所有者は 201 で日程を追加できる", async () => {
      const response = await POST_SCHEDULE(jsonRequest("POST", scheduleBody), recruitmentParams());

      expect(response.status).toBe(201);
      const json = await response.json();
      const added = port.recruitments[0].schedules.find(
        (s) => s.id.toString() === json.data.scheduleId
      );
      expect(added?.date.toString()).toBe("2099-05-01");
      expect(added?.timeRange.start).toBe("09:00");
      expect(added?.timeRange.end).toBe("15:00");
      expect(added?.capacityPerHour.value).toBe(3);
      expect(added?.approvalMode).toBe("MANUAL");
    });

    it("同じ日付の日程があれば 409", async () => {
      const response = await POST_SCHEDULE(
        jsonRequest("POST", { ...scheduleBody, date: SCHEDULE_DATE }),
        recruitmentParams()
      );

      expect(response.status).toBe(409);
      expect(port.recruitments[0].schedules).toHaveLength(1);
    });

    it("過去の日付なら 422", async () => {
      const response = await POST_SCHEDULE(
        jsonRequest("POST", { ...scheduleBody, date: "2000-01-01" }),
        recruitmentParams()
      );

      expect(response.status).toBe(422);
      expect(port.recruitments[0].schedules).toHaveLength(1);
    });

    it("終了が開始より前なら 400 で、終了時刻の項目にメッセージを返す", async () => {
      const response = await POST_SCHEDULE(
        jsonRequest("POST", { ...scheduleBody, startTime: "15:00", endTime: "09:00" }),
        recruitmentParams()
      );

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error.fields.endTime).toEqual(["終了時刻は開始時刻より後にしてください"]);
    });

    it.each([
      ["分が 00 でない時刻", { startTime: "09:30" }],
      ["24:00", { endTime: "24:00" }],
      ["定員が上限を超える", { capacityPerHour: 101 }],
      ["定員が 0", { capacityPerHour: 0 }],
      ["定員が整数でない", { capacityPerHour: 1.5 }],
      ["承認モードが不正", { approvalMode: "SOMETIMES" }],
      ["実在しない日付", { date: "2099-02-30" }],
    ])("%s は 400", async (_name, override) => {
      const response = await POST_SCHEDULE(
        jsonRequest("POST", { ...scheduleBody, ...override }),
        recruitmentParams()
      );

      expect(response.status).toBe(400);
      expect(port.recruitments[0].schedules).toHaveLength(1);
    });

    it("募集が無ければ 404", async () => {
      const response = await POST_SCHEDULE(
        jsonRequest("POST", scheduleBody),
        recruitmentParams(MISSING_ID)
      );
      expect(response.status).toBe(404);
    });
  });

  describe("PATCH /api/my/recruitments/[recruitmentId]/schedules/[scheduleId]", () => {
    it("所有者は指定した項目だけ更新できる", async () => {
      const response = await PATCH_SCHEDULE(
        jsonRequest("PATCH", { capacityPerHour: 9, approvalMode: "MANUAL" }),
        scheduleParams()
      );

      expect(response.status).toBe(200);
      const schedule = existingSchedule();
      expect(schedule.capacityPerHour.value).toBe(9);
      expect(schedule.approvalMode).toBe("MANUAL");
      expect(schedule.date.toString()).toBe(SCHEDULE_DATE);
      expect(schedule.timeRange.start).toBe("10:00");
    });

    it("時刻を片方だけ変えて、開始より前の終了になるなら 400", async () => {
      const response = await PATCH_SCHEDULE(
        jsonRequest("PATCH", { endTime: "09:00" }),
        scheduleParams()
      );

      expect(response.status).toBe(400);
      expect(existingSchedule().timeRange.end).toBe("12:00");
    });

    it("日程が無ければ 404", async () => {
      const response = await PATCH_SCHEDULE(
        jsonRequest("PATCH", { capacityPerHour: 9 }),
        scheduleParams(RECRUITMENT_ID, MISSING_ID)
      );
      expect(response.status).toBe(404);
    });

    it("別の募集の日程を指定すると 404 で、その日程は変わらない", async () => {
      port.recruitments.push(createRecruitment(OTHER_RECRUITMENT_ID, OTHER_PROJECT_ID));
      const otherSchedule = existingSchedule(OTHER_RECRUITMENT_ID);

      const response = await PATCH_SCHEDULE(
        jsonRequest("PATCH", { capacityPerHour: 9 }),
        scheduleParams(RECRUITMENT_ID, otherSchedule.id.toString())
      );

      expect(response.status).toBe(404);
      expect(existingSchedule(OTHER_RECRUITMENT_ID).capacityPerHour.value).toBe(5);
    });

    it("日程 ID の形式が不正なら 400", async () => {
      const response = await PATCH_SCHEDULE(
        jsonRequest("PATCH", { capacityPerHour: 9 }),
        scheduleParams(RECRUITMENT_ID, "not-a-uuid")
      );
      expect(response.status).toBe(400);
    });
  });

  describe("DELETE /api/my/recruitments/[recruitmentId]/schedules/[scheduleId]", () => {
    it("所有者は日程を削除できる", async () => {
      const response = await DELETE_SCHEDULE(new Request("http://localhost/api"), scheduleParams());

      expect(response.status).toBe(200);
      expect(port.recruitments[0].schedules).toHaveLength(0);
    });

    it("日程が無ければ 404", async () => {
      const response = await DELETE_SCHEDULE(
        new Request("http://localhost/api"),
        scheduleParams(RECRUITMENT_ID, MISSING_ID)
      );
      expect(response.status).toBe(404);
    });
  });
});
