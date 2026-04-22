"use client";

import { useEffect, useRef } from "react";

/**
 * 破壊的操作の確認ダイアログ (#168)
 *
 * shadcn/ui の AlertDialog 相当の簡易実装。Tailwind v4 と React のみで完結し、
 * 外部依存 (@radix-ui 等) を増やさない方針。
 *
 * 機能:
 * - Esc キーで「キャンセル」
 * - Enter キーで「確定」（確定ボタンにフォーカスがある場合は通常通り）
 * - Tab キーでのフォーカストラップ
 * - 開いた瞬間に確定ボタンへフォーカス
 * - role="alertdialog" + aria-labelledby / aria-describedby
 *
 * window.confirm の置き換え用途に特化しており、破壊的（destructive）か安全（default）かは
 * variant で切り替える。
 */

export type AlertDialogVariant = "default" | "destructive";

export interface AlertDialogProps {
  /** ダイアログを表示するかどうか */
  open: boolean;
  /** 見出し（必須） */
  title: string;
  /** 本文（任意） */
  description?: string;
  /** 確定ボタンのラベル（省略時は「OK」） */
  confirmLabel?: string;
  /** キャンセルボタンのラベル（省略時は「キャンセル」） */
  cancelLabel?: string;
  /** 見た目（確定ボタンの色）。破壊的操作は destructive を指定 */
  variant?: AlertDialogVariant;
  /** 処理中フラグ。true のときはボタンを disabled にする */
  isSubmitting?: boolean;
  /** 確定時コールバック */
  onConfirm: () => void;
  /** キャンセル時 / Esc キー押下時コールバック */
  onCancel: () => void;
  /** data-testid（確定ボタンに付与）。テスト用 */
  testId?: string;
}

export function AlertDialog({
  open,
  title,
  description,
  confirmLabel = "OK",
  cancelLabel = "キャンセル",
  variant = "default",
  isSubmitting = false,
  onConfirm,
  onCancel,
  testId,
}: AlertDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const titleId = "alert-dialog-title";
  const descId = "alert-dialog-description";

  // Esc / Enter / Tab のキーボード操作
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (!isSubmitting) {
          e.preventDefault();
          onCancel();
        }
        return;
      }

      if (e.key === "Enter") {
        // textarea / input にフォーカスがあるときは通常動作（改行など）を尊重する
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;
        if (!isSubmitting) {
          e.preventDefault();
          onConfirm();
        }
        return;
      }

      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, isSubmitting, onCancel, onConfirm]);

  // 開いたら確定ボタンへフォーカス
  useEffect(() => {
    if (open) {
      confirmBtnRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  const confirmClass =
    variant === "destructive"
      ? "bg-red-600 hover:bg-red-700"
      : "bg-blue-600 hover:bg-blue-700";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        // 背景クリックでもキャンセル
        if (e.target === e.currentTarget && !isSubmitting) {
          onCancel();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl outline-none"
      >
        <h3 id={titleId} className="mb-2 text-lg font-semibold text-gray-900">
          {title}
        </h3>
        {description && (
          <p id={descId} className="mb-6 text-sm text-gray-600">
            {description}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            data-testid={testId}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
