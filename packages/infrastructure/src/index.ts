export { prisma } from "./database/client";

// Prisma Client のクラスや runtime 値は再エクスポートしない
// (`PrismaClient` を apps/web 側で new できないようにするため)。
// モデル型・enum 値は必要になった時点で type-only 再エクスポートを追加する。
// 例:
//   export type { Account, LeaderApplication, Project, Prisma } from "@prisma/client";
//   export { AccountStatus, Role } from "@prisma/client";
