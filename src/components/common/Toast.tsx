"use client";

import { createContext, useContext, useState, useCallback, useId, useEffect } from "react";

/**
 * トーストの種類を定義
 * success: 成功時の緑色トースト
 * error: エラー時の赤色トースト
 * warning: 警告時の黄色トースト
 * info: 情報時の青色トースト
 */
export type ToastType = "success" | "error" | "warning" | "info";

/**
 * トーストデータの型定義
 */
interface ToastData {
  id: string;
  message: string;
  type: ToastType;
}

/**
 * ToastContext の型定義
 */
interface ToastContextType {
  toasts: ToastData[];
  showToast: (message: string, type: ToastType) => void;
  hideToast: (id: string) => void;
}

// デフォルト値
const ToastContext = createContext<ToastContextType>({
  toasts: [],
  showToast: () => {},
  hideToast: () => {},
});

/**
 * トーストを使用するためのカスタムフック
 * @example
 * const { showToast } = useToast();
 * showToast("保存しました", "success");
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

/**
 * ToastProvider
 * アプリ全体でトースト通知を管理するプロバイダー
 * RootLayoutでラップして使用する
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  /**
   * トーストを表示する関数
   * 3秒後に自動的に非表示になる
   */
  const showToast = useCallback((message: string, type: ToastType) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { id, message, type }]);

    // 3秒後に自動で非表示
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  /**
   * 特定のトーストを非表示にする関数
   */
  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, hideToast }}>
      {children}
      <ToastContainer toasts={toasts} onClose={hideToast} />
    </ToastContext.Provider>
  );
}

/**
 * ToastContainer
 * トーストを画面右下に表示するコンテナ
 */
function ToastContainer({
  toasts,
  onClose,
}: {
  toasts: ToastData[];
  onClose: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
      aria-live="polite"
      aria-label="通知"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} data={toast} onClose={() => onClose(toast.id)} />
      ))}
    </div>
  );
}

/**
 * Toast
 * 個別のトースト表示コンポーネント
 */
function Toast({ data, onClose }: { data: ToastData; onClose: () => void }) {
  const toastId = useId();

  // スタイルマッピング
  const typeStyles: Record<ToastType, { bg: string; icon: React.ReactNode }> = {
    success: {
      bg: "bg-green-500",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    error: {
      bg: "bg-red-500",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      ),
    },
    warning: {
      bg: "bg-yellow-500",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      ),
    },
    info: {
      bg: "bg-blue-500",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
  };

  const { bg, icon } = typeStyles[data.type];

  return (
    <div
      id={toastId}
      className={`${bg} flex items-center gap-3 rounded-lg px-4 py-3 text-white shadow-lg transition-all duration-300 animate-in slide-in-from-right-5`}
      role="alert"
    >
      <span className="flex-shrink-0">{icon}</span>
      <p className="flex-1 text-sm font-medium">{data.message}</p>
      <button
        onClick={onClose}
        className="flex-shrink-0 rounded p-1 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
        aria-label="閉じる"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}
