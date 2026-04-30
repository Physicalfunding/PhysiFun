/**
 * @jest-environment node
 */

/**
 * /api/cron/process-outbox の認証ロジックに関するテスト (#188 review L1)
 *
 * - prisma 接続を伴わないよう DI モジュールをモックする
 * - 401 / 500 (CRON_SECRET 未設定) の認可分岐のみを対象にする
 * - `next/server` の Request 等 Web 標準 API を使用するため node 環境で実行する
 */

// `@/lib/di/outbox` を import すると `@physifun/infrastructure` 経由で
// PrismaClient のコンストラクタが走るため、テストでは tick だけスタブする。
const leaderTick = jest.fn();
const projectTick = jest.fn();

jest.mock("@/lib/di/outbox", () => ({
  getLeaderApplicationOutboxWorker: () => ({
    tick: leaderTick,
  }),
  getProjectOutboxWorker: () => ({
    tick: projectTick,
  }),
}));

import { GET } from "../route";

describe("GET /api/cron/process-outbox - auth", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    leaderTick.mockReset();
    projectTick.mockReset();
    leaderTick.mockResolvedValue(undefined);
    projectTick.mockResolvedValue(undefined);
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("Authorization ヘッダーがない場合は 401 を返す", async () => {
    process.env.CRON_SECRET = "test-secret";
    const request = new Request("http://localhost/api/cron/process-outbox");

    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("Bearer トークンが不一致の場合は 401 を返す", async () => {
    process.env.CRON_SECRET = "test-secret";
    const request = new Request("http://localhost/api/cron/process-outbox", {
      headers: { authorization: "Bearer wrong-secret" },
    });

    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("CRON_SECRET 未設定なら 500 を返す (fail-closed)", async () => {
    delete process.env.CRON_SECRET;
    const request = new Request("http://localhost/api/cron/process-outbox", {
      headers: { authorization: "Bearer undefined" },
    });

    const response = await GET(request);

    expect(response.status).toBe(500);
  });

  it("tick 失敗時は 500 で failedTicks にキー名のみ返し、エラーメッセージは含まない", async () => {
    process.env.CRON_SECRET = "test-secret";
    const dbError = new Error(
      "PrismaClientKnownRequestError: relation 'leader_application_outbox_messages' does not exist"
    );
    leaderTick.mockRejectedValue(dbError);

    const request = new Request("http://localhost/api/cron/process-outbox", {
      headers: { authorization: "Bearer test-secret" },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "Internal server error",
      failedTicks: ["leader-application"],
    });
    // 内部エラーメッセージが漏出していないこと (#187 PR2 review MEDIUM 2)
    expect(JSON.stringify(body)).not.toContain("Prisma");
    expect(JSON.stringify(body)).not.toContain("relation");
  });
});
