"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface ProjectImageUploadProps {
  projectId: string;
  initialImages: string[];
}

/**
 * ProjectImageUpload コンポーネント
 * プロジェクト画像のアップロード、削除、並び替えを行うUI
 */
export function ProjectImageUpload({ projectId, initialImages }: ProjectImageUploadProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<string[]>(initialImages);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const MAX_IMAGES = 10;
  const canUploadMore = images.length < MAX_IMAGES;

  /**
   * ファイル選択ダイアログを開く
   */
  const handleClickUpload = () => {
    fileInputRef.current?.click();
  };

  /**
   * ファイルアップロード処理
   */
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // アップロード可能な残り枚数を確認
    const remainingSlots = MAX_IMAGES - images.length;
    if (files.length > remainingSlots) {
      setError(`あと${remainingSlots}枚までアップロードできます`);
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch(`/api/projects/${projectId}/images`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error?.message || "アップロードに失敗しました");
        return;
      }

      setImages(result.imageUrls);
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setIsUploading(false);
      // ファイル入力をリセット
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  /**
   * 画像削除処理
   */
  const handleDelete = async (index: number) => {
    if (!confirm("この画像を削除しますか？")) return;

    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/images`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageIndex: index }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error?.message || "削除に失敗しました");
        return;
      }

      setImages(result.imageUrls);
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    }
  };

  /**
   * ドラッグ開始
   */
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  /**
   * ドラッグオーバー
   */
  const handleDragOver = (event: React.DragEvent, index: number) => {
    event.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    // 新しい順序を計算
    const newImages = [...images];
    const draggedImage = newImages[draggedIndex];
    newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedImage);
    setImages(newImages);
    setDraggedIndex(index);
  };

  /**
   * ドラッグ終了（APIに保存）
   */
  const handleDragEnd = useCallback(async () => {
    if (draggedIndex === null) return;

    setDraggedIndex(null);

    // 現在の順序をAPIに保存
    const newOrder = images.map((_, i) => i);

    try {
      const response = await fetch(`/api/projects/${projectId}/images`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ newOrder }),
      });

      if (!response.ok) {
        const result = await response.json();
        setError(result.error?.message || "並び替えの保存に失敗しました");
        // エラー時は元に戻す
        setImages(initialImages);
      }
    } catch {
      setError("通信エラーが発生しました");
      setImages(initialImages);
    }
  }, [draggedIndex, images, projectId, initialImages]);

  return (
    <div className="space-y-4">
      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* 画像グリッド */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((url, index) => (
          <div
            key={url}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`relative aspect-square rounded-lg overflow-hidden border-2 cursor-move transition-all ${
              draggedIndex === index
                ? "border-orange-500 opacity-50"
                : "border-gray-200 hover:border-orange-300"
            }`}
          >
            <Image
              src={url}
              alt={`プロジェクト画像 ${index + 1}`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
            {/* メイン画像バッジ */}
            {index === 0 && (
              <span className="absolute top-2 left-2 bg-orange-500 text-white text-xs px-2 py-1 rounded">
                メイン
              </span>
            )}
            {/* 削除ボタン */}
            <button
              type="button"
              onClick={() => handleDelete(index)}
              className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
              title="削除"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            {/* ドラッグハンドル */}
            <div className="absolute bottom-2 right-2 bg-black/50 text-white rounded p-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8h16M4 16h16"
                />
              </svg>
            </div>
          </div>
        ))}

        {/* アップロードボタン */}
        {canUploadMore && (
          <button
            type="button"
            onClick={handleClickUpload}
            disabled={isUploading}
            className="aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-orange-400 flex flex-col items-center justify-center text-gray-500 hover:text-orange-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <svg className="animate-spin h-8 w-8 mb-2" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span className="text-sm">アップロード中...</span>
              </>
            ) : (
              <>
                <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span className="text-sm">画像を追加</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* ファイル入力（非表示） */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {/* ヘルプテキスト */}
      <div className="text-sm text-gray-500 space-y-1">
        <p>• 最大{MAX_IMAGES}枚まで、1枚あたり5MB以下のJPEG、PNG、WebP形式に対応</p>
        <p>• ドラッグ&ドロップで画像の順序を変更できます</p>
        <p>• 最初の画像がメイン画像として表示されます</p>
      </div>
    </div>
  );
}
