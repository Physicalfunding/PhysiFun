/**
 * APIヘルパーのテスト
 */
import { describe, expect, it } from "@jest/globals";
import {
  handleAppError,
  internalServerError,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
  conflictResponse,
  unprocessableEntityResponse,
  successResponse,
} from "../api-helpers";
import { AppError } from "@/domain/shared/result";

describe("api-helpers", () => {
  describe("handleAppError", () => {
    it("VALIDATION_ERRORを400で返す", () => {
      const error: AppError = { code: "VALIDATION_ERROR", message: "バリデーションエラー" };
      const response = handleAppError(error);
      expect(response.status).toBe(400);
    });

    it("NOT_FOUNDを404で返す", () => {
      const error: AppError = { code: "NOT_FOUND", resource: "プロジェクト" };
      const response = handleAppError(error);
      expect(response.status).toBe(404);
    });

    it("CONFLICTを409で返す", () => {
      const error: AppError = { code: "CONFLICT", message: "既に存在します" };
      const response = handleAppError(error);
      expect(response.status).toBe(409);
    });
  });

  describe("internalServerError", () => {
    it("500ステータスで内部エラーを返す", () => {
      const response = internalServerError();
      expect(response.status).toBe(500);
    });

    it("カスタムメッセージを設定できる", () => {
      const response = internalServerError("データベースエラー");
      expect(response.status).toBe(500);
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

  describe("notFoundResponse", () => {
    it("404ステータスで見つからないエラーを返す", () => {
      const response = notFoundResponse("プロジェクト");
      expect(response.status).toBe(404);
    });
  });

  describe("validationErrorResponse", () => {
    it("400ステータスでバリデーションエラーを返す", () => {
      const response = validationErrorResponse("入力エラー", {
        email: ["無効なメール"],
      });
      expect(response.status).toBe(400);
    });
  });

  describe("conflictResponse", () => {
    it("409ステータスで競合エラーを返す", () => {
      const response = conflictResponse("既に登録されています");
      expect(response.status).toBe(409);
    });
  });

  describe("unprocessableEntityResponse", () => {
    it("422ステータスでビジネスロジックエラーを返す", () => {
      const response = unprocessableEntityResponse("定員オーバーです");
      expect(response.status).toBe(422);
    });
  });

  describe("successResponse", () => {
    it("200ステータスで成功レスポンスを返す", () => {
      const response = successResponse({ id: "1" });
      expect(response.status).toBe(200);
    });

    it("カスタムステータスを設定できる", () => {
      const response = successResponse({ created: true }, 201);
      expect(response.status).toBe(201);
    });
  });
});
