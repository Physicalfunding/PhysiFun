import {
  AdminAccount,
  AdminAccountEmail,
  AdminAccountId,
  AdminAccountStatus,
  isAdminAccountStatus,
  type AdminAccountRepository,
} from "@physifun/domain";
import type { Insertable } from "kysely";
import { db } from "../database/kysely/client";
import type { AdminAccountsTable } from "../database/kysely/types";

/**
 * AdminAccount 集約の Kysely リポジトリ実装（Prisma 版からの移行 / #224）
 *
 * `PrismaAdminAccountRepository` と同一 API の drop-in。
 * - status / email は DB 列値とドメイン値オブジェクトの間をこの層でマッピングする。
 * - AdminAccount は物理削除しない運用のため delete メソッドは持たない（`disable()` → `update()`）。
 */
export class KyselyAdminAccountRepository implements AdminAccountRepository {
  async findByEmail(email: AdminAccountEmail): Promise<AdminAccount | null> {
    const row = await db
      .selectFrom("admin_accounts")
      .selectAll()
      .where("email", "=", email.toString())
      .executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async findById(id: AdminAccountId): Promise<AdminAccount | null> {
    const row = await db
      .selectFrom("admin_accounts")
      .selectAll()
      .where("id", "=", id.toString())
      .executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async create(adminAccount: AdminAccount): Promise<void> {
    await db.insertInto("admin_accounts").values(toInsert(adminAccount)).execute();
  }

  async update(adminAccount: AdminAccount): Promise<void> {
    await db
      .updateTable("admin_accounts")
      .set({
        email: adminAccount.email.toString(),
        status: adminAccount.status,
        lastLoginAt: adminAccount.lastLoginAt,
        updatedAt: adminAccount.updatedAt,
      })
      .where("id", "=", adminAccount.id.toString())
      .execute();
  }

  async findAll(options: {
    page: number;
    perPage: number;
  }): Promise<{ items: AdminAccount[]; totalCount: number }> {
    const offset = (options.page - 1) * options.perPage;
    const [rows, countRow] = await Promise.all([
      db
        .selectFrom("admin_accounts")
        .selectAll()
        // createdAt desc + id desc の tie-breaker でページ境界の重複・脱落を防ぐ（Prisma 版と同方針）。
        .orderBy("createdAt", "desc")
        .orderBy("id", "desc")
        .limit(options.perPage)
        .offset(offset)
        .execute(),
      db
        .selectFrom("admin_accounts")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .executeTakeFirstOrThrow(),
    ]);
    return { items: rows.map(toDomain), totalCount: Number(countRow.count) };
  }
}

// ==================== マッピングヘルパー ====================

/** AdminAccount 集約 → admin_accounts INSERT 値 */
function toInsert(a: AdminAccount): Insertable<AdminAccountsTable> {
  return {
    id: a.id.toString(),
    email: a.email.toString(),
    status: a.status,
    lastLoginAt: a.lastLoginAt,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

interface AdminAccountRow {
  id: string;
  email: string;
  status: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * DB 行をドメイン集約に戻す。
 *
 * DB 側で status enum は ACTIVE/DISABLED のみが入る前提だが、スキーマ変更時の
 * 早期検出のためランタイムでガードする（Prisma 版と同一）。
 */
function toDomain(row: AdminAccountRow): AdminAccount {
  const idResult = AdminAccountId.from(row.id);
  if (!idResult.ok) {
    throw new Error(`[KyselyAdminAccountRepository] invalid AdminAccount.id in DB: ${row.id}`);
  }
  const emailResult = AdminAccountEmail.from(row.email);
  if (!emailResult.ok) {
    throw new Error(
      `[KyselyAdminAccountRepository] invalid AdminAccount.email in DB: ${row.email}`
    );
  }
  if (!isAdminAccountStatus(row.status)) {
    throw new Error(
      `[KyselyAdminAccountRepository] unexpected AdminAccount.status in DB: ${row.status}`
    );
  }
  const status: AdminAccountStatus = row.status;

  return AdminAccount.reconstruct({
    id: idResult.value,
    email: emailResult.value,
    status,
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
