"use client";

interface ErrorDisplayProps {
  message: string;
  title?: string;
  onRetry?: () => void;
  variant?: "error" | "warning" | "info";
  className?: string;
}

/**
 * ErrorDisplay
 * エラー表示コンポーネント
 */
export function ErrorDisplay({
  message,
  title,
  onRetry,
  variant = "error",
  className = "",
}: ErrorDisplayProps) {
  const variantStyles = {
    error: "bg-red-50 border-red-200 text-red-700",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-700",
    info: "bg-blue-50 border-blue-200 text-blue-700",
  };

  const iconStyles = {
    error: "text-red-400",
    warning: "text-yellow-400",
    info: "text-blue-400",
  };

  return (
    <div
      className={`rounded-lg border p-4 ${variantStyles[variant]} ${className}`}
      role="alert"
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {variant === "error" && (
            <svg
              className={`h-5 w-5 ${iconStyles[variant]}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          )}
          {variant === "warning" && (
            <svg
              className={`h-5 w-5 ${iconStyles[variant]}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          )}
          {variant === "info" && (
            <svg
              className={`h-5 w-5 ${iconStyles[variant]}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          )}
        </div>
        <div className="ml-3 flex-1">
          {title && (
            <h3 className="text-sm font-medium">{title}</h3>
          )}
          <p className={`text-sm ${title ? "mt-1" : ""}`}>{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 text-sm font-medium underline hover:no-underline"
            >
              再試行
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * NotFound
 * 404エラー表示コンポーネント
 */
export function NotFound({ message = "ページが見つかりません" }: { message?: string }) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
      <div className="mb-4 text-6xl font-bold text-gray-300">404</div>
      <p className="text-gray-600">{message}</p>
    </div>
  );
}
