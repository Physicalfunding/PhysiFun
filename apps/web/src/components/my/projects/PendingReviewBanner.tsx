"use client";

import { useState } from "react";
import { Button, ConfirmModal } from "@/components/common";
import { useToast } from "@/components/common/Toast";

interface PendingReviewBannerProps {
  projectId: string;
  onWithdraw: () => void;
}

export function PendingReviewBanner({ projectId, onWithdraw }: PendingReviewBannerProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();

  const handleWithdraw = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/my/projects/${projectId}/withdraw`, {
        method: "POST",
      });
      if (!res.ok) {
        const json = await res.json();
        showToast(json.error?.message || "取下げに失敗しました", "error");
        return;
      }
      showToast("公開申請を取下げました", "success");
      onWithdraw();
    } catch {
      showToast("取下げに失敗しました", "error");
    } finally {
      setIsLoading(false);
      setIsConfirmOpen(false);
    }
  };

  return (
    <>
      <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-yellow-600 text-lg">&#9888;</span>
            <p className="text-sm text-yellow-800">
              このプロジェクトは現在審査中です。審査が完了するまでお待ちください。
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsConfirmOpen(true)}
            disabled={isLoading}
          >
            取下げ
          </Button>
        </div>
      </div>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleWithdraw}
        title="公開申請の取下げ"
        message="公開申請を取下げますか？プロジェクトは下書き状態に戻ります。"
        confirmLabel="取下げる"
        cancelLabel="キャンセル"
        variant="danger"
        isLoading={isLoading}
      />
    </>
  );
}
