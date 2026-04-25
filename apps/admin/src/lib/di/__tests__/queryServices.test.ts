/**
 * CachedAdminAuditLogQueryService のユニットテスト (#179 M-3)
 *
 * 検証観点:
 *   1. `listDistinctActions` / `listDistinctTargetTypes` はラップ先 (inner) に delegate される
 *   2. `findMany` は素通しで inner.findMany が呼ばれる
 *   3. 同じ引数で複数回呼んでも cached 関数経由で inner は 1 回だけ呼ばれる
 *
 * ## モック方針
 *
 * - `next/cache` の `unstable_cache` は Next.js ランタイム (RSC 文脈) でしか
 *   本来動作しないため、`bun:test` の `mock.module` で同期的な「引数で呼ばれた
 *   関数を Map でメモ化するだけ」のスタブに置き換える。
 * - これにより「同じ引数なら inner は 1 回だけ呼ばれる」という本物の挙動を
 *   単体テスト内で再現でき、#179 M-1 で module-level 化した cached 関数が
 *   正しく機能しているかも間接的に検証できる。
 *
 * 実行: `cd apps/admin && bun test`
 */

import { describe, test, expect, mock } from "bun:test";
import type {
  AdminAuditLogFilter,
  AdminAuditLogListResult,
  AdminAuditLogQueryService,
} from "@physifun/infrastructure";

// ------------------------------------------------------------
// next/cache の `unstable_cache` を引数ベースのメモ化スタブに差し替え
// ------------------------------------------------------------
// 呼び出しごとに stringify した引数をキーに Promise を再利用する。
// これにより「同じ引数で複数回呼んでも delegate は 1 回」の挙動を再現する。
mock.module("next/cache", () => ({
  unstable_cache: <TArgs extends unknown[], TReturn>(
    fn: (...args: TArgs) => Promise<TReturn>,
    _keyParts?: string[],
    _options?: { revalidate?: number; tags?: string[] }
  ) => {
    const memo = new Map<string, Promise<TReturn>>();
    return (...args: TArgs): Promise<TReturn> => {
      // delegate (クラスインスタンス) は JSON.stringify で空オブジェクト扱い
      // になるため、2 つ目以降の引数だけをキーに使う (実ランタイムと同じ挙動)。
      const key = JSON.stringify(args.slice(1));
      const hit = memo.get(key);
      if (hit) return hit;
      const p = fn(...args);
      memo.set(key, p);
      return p;
    };
  },
}));

// モック適用後に import する必要があるため動的 import を使う。
const { CachedAdminAuditLogQueryService } = await import("../queryServices");

// ------------------------------------------------------------
// シンプルな呼び出しカウンタ付き fake inner
// ------------------------------------------------------------
function createFakeInner(): {
  inner: AdminAuditLogQueryService;
  calls: { findMany: number; listDistinctActions: number; listDistinctTargetTypes: number };
} {
  const calls = { findMany: 0, listDistinctActions: 0, listDistinctTargetTypes: 0 };
  const inner: AdminAuditLogQueryService = {
    async findMany(
      _filter: AdminAuditLogFilter,
      _pagination: { page: number; perPage: number }
    ): Promise<AdminAuditLogListResult> {
      calls.findMany += 1;
      return { items: [], totalCount: 0 };
    },
    async listDistinctActions(limit = 100): Promise<string[]> {
      calls.listDistinctActions += 1;
      return [`action-${limit}`];
    },
    async listDistinctTargetTypes(limit = 100): Promise<string[]> {
      calls.listDistinctTargetTypes += 1;
      return [`target-${limit}`];
    },
  };
  return { inner, calls };
}

describe("CachedAdminAuditLogQueryService (#179)", () => {
  test("findMany は素通しで inner.findMany に delegate される", async () => {
    const { inner, calls } = createFakeInner();
    const svc = new CachedAdminAuditLogQueryService(inner);

    const result = await svc.findMany({}, { page: 1, perPage: 20 });

    expect(calls.findMany).toBe(1);
    expect(result.items.length).toBe(0);
    expect(result.totalCount).toBe(0);
  });

  test("listDistinctActions は inner.listDistinctActions に delegate される", async () => {
    const { inner, calls } = createFakeInner();
    const svc = new CachedAdminAuditLogQueryService(inner);

    const actions = await svc.listDistinctActions(50);

    expect(calls.listDistinctActions).toBe(1);
    expect(actions[0]).toBe("action-50");
  });

  test("listDistinctTargetTypes は inner.listDistinctTargetTypes に delegate される", async () => {
    const { inner, calls } = createFakeInner();
    const svc = new CachedAdminAuditLogQueryService(inner);

    const types = await svc.listDistinctTargetTypes(30);

    expect(calls.listDistinctTargetTypes).toBe(1);
    expect(types[0]).toBe("target-30");
  });

  test("同じ limit で複数回呼んでも inner.listDistinctActions は 1 回しか呼ばれない (cached)", async () => {
    // NOTE: module-level で生成した cached 関数 (スタブの memo Map) は同一
    //       テストファイル内で共有される。他のテストと衝突しない limit 値を
    //       あえて使うことで独立性を保つ。
    const { inner, calls } = createFakeInner();
    const svc = new CachedAdminAuditLogQueryService(inner);

    const a = await svc.listDistinctActions(777);
    const b = await svc.listDistinctActions(777);
    const c = await svc.listDistinctActions(777);

    expect(calls.listDistinctActions).toBe(1);
    expect(a[0]).toBe("action-777");
    expect(b[0]).toBe("action-777");
    expect(c[0]).toBe("action-777");
  });

  test("同じ limit で複数回呼んでも inner.listDistinctTargetTypes は 1 回しか呼ばれない (cached)", async () => {
    // 衝突回避のため他のテストと別の limit を使う。
    const { inner, calls } = createFakeInner();
    const svc = new CachedAdminAuditLogQueryService(inner);

    await svc.listDistinctTargetTypes(888);
    await svc.listDistinctTargetTypes(888);

    expect(calls.listDistinctTargetTypes).toBe(1);
  });
});
