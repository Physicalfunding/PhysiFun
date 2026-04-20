import type { Config } from "jest";

/**
 * @physifun/ui-shared パッケージのテスト設定。
 * ts-jest + jsdom で .ts / .tsx のテストを実行する。
 */
const config: Config = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  testMatch: ["**/__tests__/**/*.[jt]s?(x)", "**/?(*.)+(spec|test).[jt]s?(x)"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
          target: "ES2022",
          module: "commonjs",
          esModuleInterop: true,
        },
      },
    ],
  },
};

export default config;
