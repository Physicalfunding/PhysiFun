import { test as base, expect } from "@playwright/test";
import * as path from "path";

/**
 * Phase 1 E2E で共有するテストデータ・定数定義
 */

// E2E 専用ポート。ローカル開発で 3000/3001 が他用途で使われていても衝突しないよう
// 30000 番台。playwright.config.ts の WEB_PORT / ADMIN_PORT と必ず同じにすること。
export const WEB_BASE_URL = "http://localhost:31000";
export const ADMIN_BASE_URL = "http://localhost:31001";

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
  projectCategory: "EVENT",
  /** 東京都 (JIS X 0401 "13") */
  prefectureCode: "13",
  municipality: "千代田区",
  /** 電話番号（Issue #192 PR2 で Account / LeaderApplication に追加） */
  phoneNumber: "090-1234-5678",
  /** 活動内容（Issue #192 PR3 で plannedActivities → activityContent に改名） */
  activityContent: "E2Eテスト用の活動内容です。毎週土曜日に地域コミュニティの集まりを開催します。",
  /** プロジェクトの進捗（必須・ProjectPhase enum 値） */
  progress: "PLANNING",
  /** 体験できること（必須・〜150） */
  experienceOffered: "地域住民との交流を通じて新しいつながりを得られます。",
  /** 開催場所（TIME 募集枠で必須） */
  eventLocation: "千代田区コミュニティセンター",
  /** 実施期間（TIME 募集枠で必須） */
  eventPeriod: "2026年6月〜10月",
  /** 募集人数（TIME 募集枠で必須） */
  recruitCount: 5,
  /** 時間用リターン（TIME 募集枠で必須・〜200） */
  timeReturn: "活動後の交流会への招待・お礼状",
} as const;

/** テスト用 admin アカウントデータ (setup で seed される) (#145: magic link 方式のためパスワード不要) */
export const TEST_ADMIN = {
  email: "admin@e2e-test.local",
} as const;

/** プロジェクト編集時に上書きする内容 (05-project-create で使う) */
export const TEST_PROJECT = {
  summary: "E2Eテストプロジェクト（編集後）の概要テキスト",
  body: "E2Eテストプロジェクト（編集後）の詳細テキストです。\n自動テストで公開申請まで検証します。",
  leaderIntroduction: "E2Eテストのリーダー紹介です。",
  activityPlan: "E2Eテストの活動計画です。毎週末に活動します。",
  category: "EVENT",
  prefectureCode: "13",
  municipality: "千代田区",
} as const;

/** カスタム fixture (今後必要になったらここに追加) */
export const test = base.extend({});

export { expect };
