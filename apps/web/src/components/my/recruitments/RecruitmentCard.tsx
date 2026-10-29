"use client";

import type { RecruitmentDTO, RecruitmentScheduleDTO } from "@physifun/application";
import { Button, Card, CardContent } from "@/components/common";
import { APPROVAL_MODE_LABELS, formatScheduleDate } from "./scheduleFormat";

interface RecruitmentCardProps {
  recruitment: RecruitmentDTO;
  onEdit: () => void;
  onDelete: () => void;
  onAddSchedule: () => void;
  onEditSchedule: (schedule: RecruitmentScheduleDTO) => void;
  onDeleteSchedule: (schedule: RecruitmentScheduleDTO) => void;
}

/**
 * 募集 1 件のカード（タイトル・説明・日程の一覧と、それぞれの編集・削除のボタン）
 */
export function RecruitmentCard({
  recruitment,
  onEdit,
  onDelete,
  onAddSchedule,
  onEditSchedule,
  onDeleteSchedule,
}: RecruitmentCardProps) {
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

        <div className="mt-4 border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-gray-900">日程</h3>
            <Button variant="outline" size="sm" onClick={onAddSchedule}>
              日程を追加
            </Button>
          </div>
          {recruitment.schedules.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">まだ日程がありません</p>
          ) : (
            <ul className="mt-2 divide-y divide-gray-100">
              {recruitment.schedules.map((schedule) => (
                <li
                  key={schedule.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-700">
                    <span className="font-medium text-gray-900">
                      {formatScheduleDate(schedule.date)}
                    </span>
                    <span>
                      {schedule.startTime}〜{schedule.endTime}
                    </span>
                    <span>1 時間 {schedule.capacityPerHour} 人まで</span>
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {APPROVAL_MODE_LABELS[schedule.approvalMode]}
                    </span>
                  </div>
                  <div className="flex flex-shrink-0 gap-2">
                    <Button variant="outline" size="sm" onClick={() => onEditSchedule(schedule)}>
                      編集
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => onDeleteSchedule(schedule)}>
                      削除
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
