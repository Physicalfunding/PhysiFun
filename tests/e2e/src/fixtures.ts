import { test as base, expect } from "@playwright/test";
import * as path from "path";

/**
 * Phase 1 E2E で共有するテストデータ・定数定義
 */

export const WEB_BASE_URL = "http://localhost:3000";
export const ADMIN_BASE_URL = "http://localhost:3001";

/** storageState を保存するディレクトリ (tests/e2e からの相対) */
export const AUTH_DIR = path.resolve(__dirname, "../.auth");
export const LEADER_STORAGE = path.join(AUTH_DIR, "leader.json");
export const ADMIN_STORAGE = path.join(AUTH_DIR, "admin.json");

/** テスト用リーダー応募データ */
export const TEST_LEADER = {
  displayName: "E2Eテストリーダー",
  email: "leader@e2e-test.local",
  password: "LeaderPass123!",
  projectTitle: "E2Eテストプロジェクト",
  projectSummary: "E2Eテスト用のプロジェクト概要です。Playwrightによる自動テスト確認用。",
  projectStory:
    "E2Eテスト用のプロジェクトストーリーです。\nPlaywrightによる自動テストで Phase 1 メインフロー全体を検証します。",
  /** CATEGORY_MASTER のいずれか (packages/domain/src/shared/value-objects/ProjectCategory.ts) */
  projectCategory: "COMMUNITY",
  /** 東京都 (JIS X 0401 "13") */
  prefectureCode: "13",
  municipality: "千代田区",
  plannedActivities:
    "E2Eテスト用の活動予定です。毎週土曜日に地域コミュニティの集まりを開催します。",
} as const;

/** テスト用 admin アカウントデータ (setup で seed される) */
export const TEST_ADMIN = {
  email: "admin@e2e-test.local",
  password: "AdminPass123!",
  displayName: "E2E Admin",
} as const;

/** プロジェクト編集時に上書きする内容 (05-project-create で使う) */
export const TEST_PROJECT = {
  summary: "E2Eテストプロジェクト（編集後）の概要テキスト",
  body: "E2Eテストプロジェクト（編集後）の詳細テキストです。\n自動テストで公開申請まで検証します。",
  leaderIntroduction: "E2Eテストのリーダー紹介です。",
  activityPlan: "E2Eテストの活動計画です。毎週末に活動します。",
  category: "COMMUNITY",
  prefectureCode: "13",
  municipality: "千代田区",
} as const;

/** カスタム fixture (今後必要になったらここに追加) */
export const test = base.extend({});

export { expect };
