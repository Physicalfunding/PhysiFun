"use client";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  message?: string;
}

/**
 * LoadingSpinner
 * ローディング表示用スピナーコンポーネント
 */
export function LoadingSpinner({
  size = "md",
  className = "",
  message,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-2",
    lg: "h-12 w-12 border-3",
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div
        className={`animate-spin rounded-full border-orange-500 border-t-transparent ${sizeClasses[size]}`}
        role="status"
        aria-label="読み込み中"
      />
      {message && (
        <p className="mt-2 text-sm text-gray-500">{message}</p>
      )}
    </div>
  );
}

/**
 * PageLoading
 * ページ全体のローディング表示
 */
export function PageLoading({ message = "読み込み中..." }: { message?: string }) {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <LoadingSpinner size="lg" message={message} />
    </div>
  );
}
