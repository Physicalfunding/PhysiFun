/**
 * @jest-environment node
 */
/**
 * APIレスポンスユーティリティのテスト
 *
 * `NextResponse` は Web Fetch API の `Request` グローバルに依存するため、
 * 既定の jsdom 環境では `ReferenceError: Request is not defined` で落ちる。
 * Node 環境を明示する。
 */
import { describe, expect, it } from "@jest/globals";
import {
  ApiResponse,
  successResponse,
  errorResponse,
  validationErrorResponse,
  notFoundResponse,
  unauthorizedResponse,
  forbiddenResponse,
  conflictResponse,
} from "../response";

describe("ApiResponse", () => {
  describe("successResponse", () => {
    it("200ステータスで成功レスポンスを返す", () => {
      const data = { id: "1", name: "Test" };
      const response = successResponse(data);
      expect(response.status).toBe(200);
    });

    it("カスタムステータスコードを設定できる", () => {
      const response = successResponse({ created: true }, 201);
      expect(response.status).toBe(201);
    });
  });

  describe("errorResponse", () => {
    it("指定されたステータスでエラーレスポンスを返す", () => {
      const response = errorResponse("エラーが発生しました", "INTERNAL_ERROR", 500);
      expect(response.status).toBe(500);
    });
  });

  describe("validationErrorResponse", () => {
    it("400ステータスでバリデーションエラーを返す", () => {
      const errors = {
        email: ["無効なメールアドレスです"],
        password: ["パスワードは8文字以上必要です"],
      };
      const response = validationErrorResponse("入力内容に誤りがあります", errors);
      expect(response.status).toBe(400);
    });
  });

  describe("notFoundResponse", () => {
    it("404ステータスで見つからないエラーを返す", () => {
      const response = notFoundResponse("プロジェクト");
      expect(response.status).toBe(404);
    });
  });

  describe("unauthorizedResponse", () => {
    it("401ステータスで未認証エラーを返す", () => {
      const response = unauthorizedResponse();
      expect(response.status).toBe(401);
    });
  });

  describe("forbiddenResponse", () => {
    it("403ステータスで権限エラーを返す", () => {
      const response = forbiddenResponse();
      expect(response.status).toBe(403);
    });
  });

  describe("conflictResponse", () => {
    it("409ステータスで競合エラーを返す", () => {
      const response = conflictResponse("このメールアドレスは既に登録されています");
      expect(response.status).toBe(409);
    });
  });
});
