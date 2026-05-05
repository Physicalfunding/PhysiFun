/**
 * @jest-environment node
 */
import {
  isLeaderApplicationEnabledServer,
  isLeaderApplicationEnabledClient,
} from "../featureFlags";

/**
 * NODE_ENV / フラグ env を読み書きするためのヘルパ。
 * Jest はテスト間で process.env を共有するため、各テストの末尾で復元する。
 */
function withEnv(envs: Record<string, string | undefined>, fn: () => void) {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(envs)) {
    previous[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

describe("featureFlags", () => {
  describe("isLeaderApplicationEnabledServer", () => {
    it("NODE_ENV !== production なら常に true", () => {
      withEnv(
        {
          NODE_ENV: "development",
          LEADER_APPLICATION_ENABLED: undefined,
        },
        () => {
          expect(isLeaderApplicationEnabledServer()).toBe(true);
        }
      );
    });

    it("production で flag 未設定なら false", () => {
      withEnv(
        {
          NODE_ENV: "production",
          LEADER_APPLICATION_ENABLED: undefined,
        },
        () => {
          expect(isLeaderApplicationEnabledServer()).toBe(false);
        }
      );
    });

    it("production で flag が 'true' なら true", () => {
      withEnv(
        {
          NODE_ENV: "production",
          LEADER_APPLICATION_ENABLED: "true",
        },
        () => {
          expect(isLeaderApplicationEnabledServer()).toBe(true);
        }
      );
    });

    it("production で flag が 'false' なら false", () => {
      withEnv(
        {
          NODE_ENV: "production",
          LEADER_APPLICATION_ENABLED: "false",
        },
        () => {
          expect(isLeaderApplicationEnabledServer()).toBe(false);
        }
      );
    });

    it("'1' / 'yes' でも有効化される", () => {
      withEnv(
        { NODE_ENV: "production", LEADER_APPLICATION_ENABLED: "1" },
        () => {
          expect(isLeaderApplicationEnabledServer()).toBe(true);
        }
      );
      withEnv(
        { NODE_ENV: "production", LEADER_APPLICATION_ENABLED: "YES" },
        () => {
          expect(isLeaderApplicationEnabledServer()).toBe(true);
        }
      );
    });
  });

  describe("isLeaderApplicationEnabledClient", () => {
    it("NODE_ENV !== production なら常に true", () => {
      withEnv(
        {
          NODE_ENV: "test",
          NEXT_PUBLIC_LEADER_APPLICATION_ENABLED: undefined,
        },
        () => {
          expect(isLeaderApplicationEnabledClient()).toBe(true);
        }
      );
    });

    it("production で NEXT_PUBLIC flag 未設定なら false", () => {
      withEnv(
        {
          NODE_ENV: "production",
          NEXT_PUBLIC_LEADER_APPLICATION_ENABLED: undefined,
        },
        () => {
          expect(isLeaderApplicationEnabledClient()).toBe(false);
        }
      );
    });

    it("production で NEXT_PUBLIC flag が 'true' なら true", () => {
      withEnv(
        {
          NODE_ENV: "production",
          NEXT_PUBLIC_LEADER_APPLICATION_ENABLED: "true",
        },
        () => {
          expect(isLeaderApplicationEnabledClient()).toBe(true);
        }
      );
    });
  });
});
