// packages/ のアーキテクチャ境界ルール（apps は各アプリの eslint.config.mjs）
// 参照: CLAUDE.md「禁止事項」/ docs/guides/ai-harness.md P3
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

const DB_LIBS = ["@supabase/*", "@prisma/*", "kysely", "kysely/*", "pg", "pg/*"];
const DOMAIN_EXTERNALS = [
  "next",
  "next/*",
  "next-auth",
  "next-auth/*",
  "react",
  "react/*",
  "zod",
  "bcrypt*",
  "jose",
  "resend",
  "@upstash/*",
];

/** @param {{ group: string[]; message: string }[]} groups */
const restrictImports = (groups) => ({
  "@typescript-eslint/no-restricted-imports": [
    "error",
    { patterns: groups.map((g) => ({ ...g, allowTypeImports: true })) },
  ],
});

const dbGroup = {
  group: DB_LIBS,
  message:
    "Supabase SDK・DB クライアントは packages/infrastructure の中でだけ使う（CLAUDE.md 禁止事項）",
};

const TEST_FILES = ["**/__tests__/**", "**/*.test.ts", "**/*.test.tsx", "**/*.vitest.ts"];

export default defineConfig([
  globalIgnores(["**/node_modules/**", "**/dist/**"]),
  {
    files: ["packages/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "@typescript-eslint": tseslint.plugin },
  },
  {
    files: ["packages/**/*.{ts,tsx}"],
    ignores: ["packages/infrastructure/**", ...TEST_FILES],
    rules: restrictImports([dbGroup]),
  },
  {
    files: ["packages/domain/**/*.{ts,tsx}"],
    ignores: TEST_FILES,
    rules: restrictImports([
      dbGroup,
      {
        group: DOMAIN_EXTERNALS,
        message: "domain には外部ライブラリを持ち込まない（CLAUDE.md 禁止事項）",
      },
      {
        group: [
          "@physifun/application",
          "@physifun/application/*",
          "@physifun/infrastructure",
          "@physifun/infrastructure/*",
        ],
        message:
          "domain は他のレイヤーに依存しない（依存方向: Application → Domain ← Infrastructure）",
      },
    ]),
  },
  {
    files: ["packages/application/**/*.{ts,tsx}"],
    ignores: TEST_FILES,
    rules: restrictImports([
      dbGroup,
      {
        group: ["@physifun/infrastructure", "@physifun/infrastructure/*"],
        message: "application は infrastructure に依存しない。Port インターフェース経由で注入する",
      },
    ]),
  },
  {
    files: ["packages/{domain,application}/**/*.{ts,tsx}"],
    ignores: TEST_FILES,
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message: "domain / application で環境変数を直接読まない。設定は呼び出し側から注入する",
        },
      ],
    },
  },
]);
