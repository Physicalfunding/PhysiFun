"use client";

import { useState, useRef, ChangeEvent } from "react";
import { useRouter } from "next/navigation";

/**
 * 許可される画像MIMEタイプ
 */
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * 最大ファイルサイズ（5MB）
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

interface AvatarUploadProps {
  /** 現在のアバターURL */
  currentAvatarUrl: string | null;
  /** ユーザー名（アバターなしの場合のイニシャル表示用） */
  userName: string;
  /** アップロード成功時のコールバック */
  onUploadSuccess?: (newAvatarUrl: string) => void;
}

/**
 * AvatarUpload
 * アバター画像アップロードコンポーネント
 *
 * 機能:
 * - 画像プレビュー表示
 * - ドラッグ&ドロップ対応
 * - ファイル形式・サイズのバリデーション
 * - アップロード進捗表示
 */
export function AvatarUpload({ currentAvatarUrl, userName, onUploadSuccess }: AvatarUploadProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  /**
   * ファイル選択時の処理
   */
  const handleFileSelect = async (file: File) => {
    setError(null);

    // ファイルタイプのバリデーション
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("JPEG、PNG、WebP形式の画像のみアップロードできます");
      return;
    }

    // ファイルサイズのバリデーション
    if (file.size > MAX_FILE_SIZE) {
      setError("ファイルサイズは5MB以下にしてください");
      return;
    }

    // プレビュー表示
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // アップロード実行
    await uploadFile(file);
  };

  /**
   * ファイルをアップロード
   */
  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/users/me/avatar", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error?.message || "アップロードに失敗しました");
        setPreviewUrl(null);
        return;
      }

      // 成功時の処理
      onUploadSuccess?.(result.avatarUrl);
      router.refresh();
    } catch {
      setError("ネットワークエラーが発生しました");
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * ファイル入力変更時のハンドラ
   */
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  /**
   * ドラッグオーバー時のハンドラ
   */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  /**
   * ドラッグリーブ時のハンドラ
   */
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  /**
   * ドロップ時のハンドラ
   */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  /**
   * クリック時のハンドラ
   */
  const handleClick = () => {
    fileInputRef.current?.click();
  };

  // 表示するアバター画像URL（プレビュー > 現在の画像）
  const displayUrl = previewUrl || currentAvatarUrl;

  return (
    <div className="space-y-4">
      {/* アバター画像エリア */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative mx-auto h-32 w-32 cursor-pointer overflow-hidden rounded-full border-4 transition-all ${
          isDragging ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-orange-400"
        } ${isUploading ? "pointer-events-none opacity-50" : ""}`}
        role="button"
        tabIndex={0}
        aria-label="アバター画像をアップロード"
        onKeyDown={(e) => e.key === "Enter" && handleClick()}
      >
        {displayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={displayUrl} alt={userName} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-200">
            <span className="text-3xl font-semibold text-gray-500">
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* オーバーレイ（ホバー時） */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
          <span className="text-sm font-medium text-white">
            {isUploading ? "アップロード中..." : "画像を変更"}
          </span>
        </div>

        {/* ローディングインジケーター */}
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          </div>
        )}
      </div>

      {/* 隠しファイル入力 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleInputChange}
        className="hidden"
        aria-hidden="true"
      />

      {/* 説明テキスト */}
      <p className="text-center text-xs text-gray-500">
        クリックまたはドラッグ&ドロップで画像を選択
        <br />
        JPEG, PNG, WebP（5MB以下）
      </p>

      {/* エラーメッセージ */}
      {error && (
        <div className="rounded-md bg-red-50 p-3">
          <p className="text-center text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}
