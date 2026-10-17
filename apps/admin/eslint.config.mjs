import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// ラチェット例外: 境界ルール導入前からの違反。解消用 Issue（#284）で減らしていく。新規追加禁止
const BOUNDARY_RATCHET = [
  "src/app/api/admin/applications/[[]id]/approve/route.ts",
  "src/app/api/admin/applications/[[]id]/reject/route.ts",
  "src/app/api/admin/members/[[]id]/disable/route.ts",
  "src/app/api/admin/members/route.ts",
  "src/app/api/admin/outbox/[[]id]/complete/route.ts",
  "src/app/api/admin/outbox/[[]id]/retry/route.ts",
  "src/app/api/admin/outbox/route.ts",
  "src/app/api/auth/[[]...nextauth]/route.ts",
  "src/app/api/cron/gc-admin-auth/route.ts",
  "src/app/outbox/page.tsx",
  "src/lib/api/auditLog.ts",
  "src/lib/auth.ts",
  "src/lib/outbox.ts",
  "src/lib/rateLimit.ts",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // アーキテクチャ境界: DB クライアントと infrastructure は lib/di/ 経由でだけ使う
  // 参照: CLAUDE.md「禁止事項」/ docs/guides/ai-harness.md P3
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/lib/di/**",
      "**/__tests__/**",
      "**/*.test.ts",
      "**/*.test.tsx",
      ...BOUNDARY_RATCHET,
    ],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@supabase/*",
                "@prisma/*",
                "kysely",
                "kysely/*",
                "pg",
                "pg/*",
                "@physifun/infrastructure",
                "@physifun/infrastructure/*",
              ],
              allowTypeImports: true,
              message:
                "DB クライアントと @physifun/infrastructure は src/lib/di/ からだけ使う（CLAUDE.md 禁止事項）",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
