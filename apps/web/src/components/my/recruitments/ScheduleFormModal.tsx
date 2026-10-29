"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  APPROVAL_MODE_VALUES,
  type ApprovalMode,
  CAPACITY_PER_HOUR_LIMITS,
} from "@physifun/domain";
import { Button, Input, Modal, Select } from "@/components/common";
import { scheduleSchema, type ScheduleFormValues } from "@/lib/validations/scheduleSchema";
import { APPROVAL_MODE_LABELS } from "./scheduleFormat";

/** "00:00"〜"23:00"（domain の TimeRange と同じく 1 時間刻み。"24:00" は無い） */
const HOURS = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")}:00`);

/** 開始は "22:00" まで、終了は "01:00" から（終了は開始より後なので） */
const START_TIME_OPTIONS = HOURS.slice(0, -1).map((value) => ({ value, label: value }));
const END_TIME_OPTIONS = HOURS.slice(1).map((value) => ({ value, label: value }));

const APPROVAL_MODE_DESCRIPTIONS: Record<ApprovalMode, string> = {
  AUTO: "申し込んだ時点で確定",
  MANUAL: "リーダーが承認して確定",
};

const APPROVAL_MODE_OPTIONS = APPROVAL_MODE_VALUES.map((value) => ({
  value,
  label: `${APPROVAL_MODE_LABELS[value]}（${APPROVAL_MODE_DESCRIPTIONS[value]}）`,
}));

const EMPTY_VALUES: ScheduleFormValues = {
  date: "",
  startTime: "10:00",
  endTime: "12:00",
  capacityPerHour: 1,
  approvalMode: "MANUAL",
};

interface ScheduleFormModalProps {
  /** モーダルの見出し（「日程を追加」など） */
  heading: string;
  submitLabel: string;
  /** 編集のときの今の値。追加のときは省略する */
  defaultValues?: ScheduleFormValues;
  /** 日付の入力で選べる最も早い日（"YYYY-MM-DD"）。過去の日付を選びにくくするだけで、判定はサーバーが行う */
  minDate: string;
  onClose: () => void;
  /** 保存に成功したらモーダルを閉じるのは呼び出し側 */
  onSubmit: (values: ScheduleFormValues) => Promise<void>;
}

/**
 * 日程（日付・時間帯・1 時間ごとの定員・承認モード）の追加・編集モーダル
 *
 * 開くたびに初期値から始めるため、呼び出し側は開いているときだけ描画する。
 */
export function ScheduleFormModal({
  heading,
  submitLabel,
  defaultValues,
  minDate,
  onClose,
  onSubmit,
}: ScheduleFormModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: defaultValues ?? EMPTY_VALUES,
  });

  return (
    <Modal isOpen onClose={onClose} title={heading} size="lg">
      {/* ブラウザ標準の入力チェック（required・min）を止め、Zod とサーバーのメッセージを出す */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Input
          type="date"
          label="日付"
          required
          min={minDate}
          helperText="1 つの募集に、同じ日付の日程は 1 つまで"
          error={errors.date?.message}
          {...register("date")}
        />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="開始時刻"
            required
            options={START_TIME_OPTIONS}
            error={errors.startTime?.message}
            {...register("startTime")}
          />
          <Select
            label="終了時刻"
            required
            options={END_TIME_OPTIONS}
            error={errors.endTime?.message}
            {...register("endTime")}
          />
        </div>
        <Input
          type="number"
          label="1 時間ごとの定員"
          required
          min={CAPACITY_PER_HOUR_LIMITS.min}
          max={CAPACITY_PER_HOUR_LIMITS.max}
          step={1}
          helperText={`${CAPACITY_PER_HOUR_LIMITS.min}〜${CAPACITY_PER_HOUR_LIMITS.max}人`}
          error={errors.capacityPerHour?.message}
          {...register("capacityPerHour", { valueAsNumber: true })}
        />
        <Select
          label="承認モード"
          required
          options={APPROVAL_MODE_OPTIONS}
          error={errors.approvalMode?.message}
          {...register("approvalMode")}
        />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            キャンセル
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
