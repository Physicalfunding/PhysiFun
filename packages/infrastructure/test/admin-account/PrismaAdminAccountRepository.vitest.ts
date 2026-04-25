import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaAdminAccountRepository } from "../../src/admin-account/PrismaAdminAccountRepository";
import { disconnectTestPrisma, getTestPrisma, resetDatabase } from "../helpers/prisma";

/**
 * PrismaAdminAccountRepository.findAll の integration test (#167 review)
 *
 * members API のページネーション (#167) 実装で追加した `findAll` の挙動を、
 * 実 Postgres を使って検証する。具体的には以下を担保する:
 *
 * 1. `skip` / `take` がページ番号と perPage から正しく組み立てられる
 * 2. `totalCount` が実行中の where と一致する (将来のフィルタ追加時の漏れ防止)
 * 3. createdAt 降順 + tie-breaker (id desc) で順序が安定し、
 *    ページ境界で重複・脱落が起きない
 *
 * テストファイル配置は audit-logs の integration test と同じ
 * `test/admin-account/*.vitest.ts` に揃える (testcontainers + 実 Postgres)。
 */
describe("PrismaAdminAccountRepository.findAll integration", () => {
  const prisma = getTestPrisma();
  const repo = new PrismaAdminAccountRepository();

  beforeAll(async () => {
    await resetDatabase(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  /**
   * createdAt を明示指定して N 件の AdminAccount を投入するヘルパー。
   *
   * 順序検証のため createdAt は降順で返したい「新しいものから」順に
   * 1 秒刻みで過去に遡る形で設定する。
   */
  async function seedAccounts(count: number): Promise<void> {
    const baseNow = new Date("2026-01-01T00:00:00.000Z").getTime();
    // Prisma の createMany は default(now()) を上書きしつつまとめて INSERT できる。
    const data = Array.from({ length: count }, (_, i) => ({
      email: `admin-${String(i).padStart(3, "0")}@example.com`,
      status: "ACTIVE" as const,
      // i=0 が最新、i=count-1 が最古 (findAll は createdAt desc 並び)
      createdAt: new Date(baseNow - i * 1000),
      updatedAt: new Date(baseNow - i * 1000),
    }));
    await prisma.adminAccount.createMany({ data });
  }

  it("page=1 / perPage=10 で skip=0 / take=10 相当の結果を返す", async () => {
    await seedAccounts(25);

    const result = await repo.findAll({ page: 1, perPage: 10 });

    expect(result.totalCount).toBe(25);
    expect(result.items).toHaveLength(10);
    // 新しい順: i=0 (admin-000) が先頭
    expect(result.items[0].email.toString()).toBe("admin-000@example.com");
    expect(result.items[9].email.toString()).toBe("admin-009@example.com");
  });

  it("page=2 に進むと skip が効き、次の perPage 件を返す", async () => {
    await seedAccounts(25);

    const page1 = await repo.findAll({ page: 1, perPage: 10 });
    const page2 = await repo.findAll({ page: 2, perPage: 10 });

    expect(page2.totalCount).toBe(25);
    expect(page2.items).toHaveLength(10);
    // page1 と page2 の id が一切重複しない (skip が効いている)
    const page1Ids = new Set(page1.items.map((a) => a.id.toString()));
    const page2Ids = new Set(page2.items.map((a) => a.id.toString()));
    const intersection = [...page1Ids].filter((id) => page2Ids.has(id));
    expect(intersection).toEqual([]);

    // 新しい順なので page2 先頭は admin-010
    expect(page2.items[0].email.toString()).toBe("admin-010@example.com");
    expect(page2.items[9].email.toString()).toBe("admin-019@example.com");
  });

  it("最終ページは残り分のみ返し、totalCount はフィルタ後の総数と一致する", async () => {
    await seedAccounts(25);

    const page3 = await repo.findAll({ page: 3, perPage: 10 });

    expect(page3.totalCount).toBe(25);
    // 25 件中 20 件スキップして残り 5 件
    expect(page3.items).toHaveLength(5);
    expect(page3.items[0].email.toString()).toBe("admin-020@example.com");
    expect(page3.items[4].email.toString()).toBe("admin-024@example.com");
  });

  it("perPage=1 で複数ページに分割され、全件ユニークに回収できる", async () => {
    await seedAccounts(5);

    const pages = await Promise.all([
      repo.findAll({ page: 1, perPage: 1 }),
      repo.findAll({ page: 2, perPage: 1 }),
      repo.findAll({ page: 3, perPage: 1 }),
      repo.findAll({ page: 4, perPage: 1 }),
      repo.findAll({ page: 5, perPage: 1 }),
    ]);

    for (const p of pages) {
      expect(p.totalCount).toBe(5);
      expect(p.items).toHaveLength(1);
    }
    // 5 ページ分の id を集めて全件ユニークであることを確認
    const ids = pages.flatMap((p) => p.items.map((a) => a.id.toString()));
    expect(new Set(ids).size).toBe(5);
  });

  it("totalCount は空テーブルで 0、items も空配列を返す", async () => {
    const result = await repo.findAll({ page: 1, perPage: 10 });

    expect(result.totalCount).toBe(0);
    expect(result.items).toEqual([]);
  });

  it("createdAt が同値の行で id desc の tie-breaker が効き、ページ境界で重複・脱落しない", async () => {
    // createdAt を完全に同値にした 6 件を投入する。
    // tie-breaker が無いと findMany の skip/take で重複・脱落の可能性がある。
    const sameInstant = new Date("2026-02-01T00:00:00.000Z");
    await prisma.adminAccount.createMany({
      data: Array.from({ length: 6 }, (_, i) => ({
        email: `tie-${i}@example.com`,
        status: "ACTIVE" as const,
        createdAt: sameInstant,
        updatedAt: sameInstant,
      })),
    });

    const page1 = await repo.findAll({ page: 1, perPage: 3 });
    const page2 = await repo.findAll({ page: 2, perPage: 3 });

    expect(page1.totalCount).toBe(6);
    expect(page2.totalCount).toBe(6);
    expect(page1.items).toHaveLength(3);
    expect(page2.items).toHaveLength(3);

    // ページ間で id の重複が無い (これが tie-breaker の最重要検証)
    const page1Ids = page1.items.map((a) => a.id.toString());
    const page2Ids = page2.items.map((a) => a.id.toString());
    const overlap = page1Ids.filter((id) => page2Ids.includes(id));
    expect(overlap).toEqual([]);

    // 2 ページ合わせて全 6 件をユニークに網羅
    expect(new Set([...page1Ids, ...page2Ids]).size).toBe(6);

    // 同一クエリを再実行しても順序が決定論的に安定する (id desc による)
    const page1Again = await repo.findAll({ page: 1, perPage: 3 });
    expect(page1Again.items.map((a) => a.id.toString())).toEqual(page1Ids);

    // 実際に id desc になっていること (tie-breaker 方向の確認)
    const idsDesc = [...page1Ids].sort().reverse();
    expect(page1Ids).toEqual(idsDesc);
  });
});
