"use client";

import type { RecruitmentDTO } from "@physifun/application";
import { Button, Card, CardContent } from "@/components/common";

interface RecruitmentCardProps {
  recruitment: RecruitmentDTO;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * 募集 1 件のカード（タイトル・説明と、編集・削除のボタン）
 */
export function RecruitmentCard({ recruitment, onEdit, onDelete }: RecruitmentCardProps) {
  return (
    <Card>
      <CardContent>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-900 break-words">{recruitment.title}</h2>
          <div className="flex flex-shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={onEdit}>
              編集
            </Button>
            <Button variant="danger" size="sm" onClick={onDelete}>
              削除
            </Button>
          </div>
        </div>
        <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap break-words">
          {recruitment.description}
        </p>
      </CardContent>
    </Card>
  );
}
