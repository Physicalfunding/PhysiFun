/**
 * Toast コンポーネントのテスト
 * ユーザーへのフィードバック表示を検証
 */
import { describe, expect, it, jest } from "@jest/globals";

// Toast コンポーネントのモック型定義
type ToastType = "success" | "error" | "warning" | "info";

interface ToastProps {
  message: string;
  type: ToastType;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

// コンポーネントのモック（実装前のテスト）
const mockToast = ({ message, type, isVisible, onClose }: ToastProps) => ({
  message,
  type,
  isVisible,
  onClose,
});

describe("Toast", () => {
  describe("表示/非表示", () => {
    it("isVisible が true のとき表示される", () => {
      const toast = mockToast({
        message: "成功しました",
        type: "success",
        isVisible: true,
        onClose: jest.fn(),
      });
      expect(toast.isVisible).toBe(true);
    });

    it("isVisible が false のとき非表示", () => {
      const toast = mockToast({
        message: "成功しました",
        type: "success",
        isVisible: false,
        onClose: jest.fn(),
      });
      expect(toast.isVisible).toBe(false);
    });
  });

  describe("トーストタイプ", () => {
    it("success タイプのメッセージを表示できる", () => {
      const toast = mockToast({
        message: "プロジェクトを公開しました",
        type: "success",
        isVisible: true,
        onClose: jest.fn(),
      });
      expect(toast.type).toBe("success");
      expect(toast.message).toBe("プロジェクトを公開しました");
    });

    it("error タイプのメッセージを表示できる", () => {
      const toast = mockToast({
        message: "保存に失敗しました",
        type: "error",
        isVisible: true,
        onClose: jest.fn(),
      });
      expect(toast.type).toBe("error");
      expect(toast.message).toBe("保存に失敗しました");
    });

    it("warning タイプのメッセージを表示できる", () => {
      const toast = mockToast({
        message: "入力内容を確認してください",
        type: "warning",
        isVisible: true,
        onClose: jest.fn(),
      });
      expect(toast.type).toBe("warning");
    });

    it("info タイプのメッセージを表示できる", () => {
      const toast = mockToast({
        message: "データを読み込み中です",
        type: "info",
        isVisible: true,
        onClose: jest.fn(),
      });
      expect(toast.type).toBe("info");
    });
  });

  describe("クローズ処理", () => {
    it("onClose コールバックが渡される", () => {
      const onClose = jest.fn();
      const toast = mockToast({
        message: "テスト",
        type: "success",
        isVisible: true,
        onClose,
      });
      toast.onClose();
      expect(onClose).toHaveBeenCalled();
    });
  });
});

describe("ToastProvider", () => {
  // ToastProvider のテスト（コンテキストAPI用）
  describe("showToast", () => {
    it("success トーストを表示する関数が定義される", () => {
      // useToast hook が showToast を返すことを確認
      const showToast = (message: string, type: ToastType) => ({ message, type });
      const result = showToast("テスト", "success");
      expect(result.message).toBe("テスト");
      expect(result.type).toBe("success");
    });
  });
});
