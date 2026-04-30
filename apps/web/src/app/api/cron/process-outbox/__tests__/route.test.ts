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
jest.mock("@/lib/di/outbox", () => ({
  getLeaderApplicationOutboxWorker: () => ({
    tick: jest.fn().mockResolvedValue(undefined),
  }),
}));

import { GET } from "../route";

describe("GET /api/cron/process-outbox - auth", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
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
});
