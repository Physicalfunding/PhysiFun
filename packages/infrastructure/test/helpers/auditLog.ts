import {
  writeAdminAuditLog,
  type WriteAdminAuditLogParams,
} from "../../src/admin-account/KyselyAdminAuditLogAdapter";
import { db } from "./db";

/**
 * 並び順を検証するテストの fixture 用の基準時刻。
 * 実行時刻（DB の DEFAULT now()）より必ず過去にして、直前に書いた行が常に最新になるようにする。
 */
const FIXTURE_START = new Date("2026-01-01T00:00:00.000Z");

/**
 * `writeAdminAuditLog` で渡された順に書き、`createdAt` を書き込み順に 1 秒刻みで上書きする。
 *
 * `createdAt` は `timestamp(3)`（ミリ秒精度）の DEFAULT now() で、`writeAdminAuditLog` は指定できない。
 * 連続で書いた行は同じミリ秒になりうり、`ORDER BY createdAt DESC, id DESC` の `id` は
 * ランダムな UUID なので、同時刻の行の並びは書き込み順と無関係になる。
 * 「新しい順」を検証するテストは、この関数で時刻を明示して順序を決定的にする。
 */
export async function writeAdminAuditLogsInOrder(
  entries: readonly WriteAdminAuditLogParams[]
): Promise<void> {
  for (const [index, entry] of entries.entries()) {
    await writeAdminAuditLog(entry);

    // 書いたばかりの行は createdAt が実行時刻なので、これまでに上書きした行（過去）より新しい
    const written = await db
      .selectFrom("admin_audit_logs")
      .select("id")
      .orderBy("createdAt", "desc")
      .limit(1)
      .executeTakeFirstOrThrow();
    await db
      .updateTable("admin_audit_logs")
      .set({ createdAt: new Date(FIXTURE_START.getTime() + (index + 1) * 1000) })
      .where("id", "=", written.id)
      .execute();
  }
}
