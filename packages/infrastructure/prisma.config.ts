import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// DATABASE_URL は apps/web/.env.local で管理している（Next.js と共有）。
// packages/infrastructure から Prisma CLI を動かすためにここで明示的に読み込む。
loadEnv({ path: path.resolve(__dirname, "../../apps/web/.env.local") });
loadEnv({ path: path.resolve(__dirname, "../../apps/web/.env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
