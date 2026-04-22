import {
  AdminAccount,
  AdminAccountEmail,
  AdminAccountId,
  AdminAccountStatus,
  isAdminAccountStatus,
  type AdminAccountRepository,
} from "@physifun/domain";
import { prisma } from "../database/client";

/**
 * AdminAccount 集約の Prisma リポジトリ実装 (#148)
 *
 * - status / email は DB 列値とドメイン値オブジェクトの間を
 *   この層でマッピングし、アプリ層には集約のみを露出する。
 * - AdminAccount は物理削除しない運用のため、delete メソッドは持たない
 *   (`disable()` → `update()` で DISABLED 化する)。
 */
export class PrismaAdminAccountRepository implements AdminAccountRepository {
  async findByEmail(email: AdminAccountEmail): Promise<AdminAccount | null> {
    const row = await prisma.adminAccount.findUnique({
      where: { email: email.toString() },
    });
    return row ? toDomain(row) : null;
  }

  async findById(id: AdminAccountId): Promise<AdminAccount | null> {
    const row = await prisma.adminAccount.findUnique({
      where: { id: id.toString() },
    });
    return row ? toDomain(row) : null;
  }

  async create(adminAccount: AdminAccount): Promise<void> {
    await prisma.adminAccount.create({
      data: {
        id: adminAccount.id.toString(),
        email: adminAccount.email.toString(),
        status: adminAccount.status,
        lastLoginAt: adminAccount.lastLoginAt,
        createdAt: adminAccount.createdAt,
        updatedAt: adminAccount.updatedAt,
      },
    });
  }

  async update(adminAccount: AdminAccount): Promise<void> {
    await prisma.adminAccount.update({
      where: { id: adminAccount.id.toString() },
      data: {
        email: adminAccount.email.toString(),
        status: adminAccount.status,
        lastLoginAt: adminAccount.lastLoginAt,
        updatedAt: adminAccount.updatedAt,
      },
    });
  }

  async findAll(): Promise<AdminAccount[]> {
    const rows = await prisma.adminAccount.findMany({
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDomain);
  }
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
 * DB 側で status enum は `AdminAccountStatus` と同値の ACTIVE/DISABLED のみが
 * 入る前提だが、スキーマ変更時の早期検出のためランタイムでガードする。
 */
function toDomain(row: AdminAccountRow): AdminAccount {
  const idResult = AdminAccountId.from(row.id);
  if (!idResult.ok) {
    throw new Error(`[PrismaAdminAccountRepository] invalid AdminAccount.id in DB: ${row.id}`);
  }
  const emailResult = AdminAccountEmail.from(row.email);
  if (!emailResult.ok) {
    throw new Error(
      `[PrismaAdminAccountRepository] invalid AdminAccount.email in DB: ${row.email}`
    );
  }
  if (!isAdminAccountStatus(row.status)) {
    throw new Error(
      `[PrismaAdminAccountRepository] unexpected AdminAccount.status in DB: ${row.status}`
    );
  }
  // ランタイム判定は isAdminAccountStatus で済んでいるが、
  // 明示的に AdminAccountStatus の値であることを TS 型にも伝えるため代入。
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
