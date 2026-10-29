"use client";

import { useCallback, useEffect, useState } from "react";
import type { RecruitmentDTO, RecruitmentScheduleDTO } from "@physifun/application";
import { Button, Card, CardContent, ConfirmModal, LoadingSpinner } from "@/components/common";
import { useToast } from "@/components/common/Toast";
import type { RecruitmentFormValues } from "@/lib/validations/recruitmentSchema";
import type { ScheduleFormValues } from "@/lib/validations/scheduleSchema";
import { RecruitmentCard } from "./RecruitmentCard";
import { RecruitmentFormModal } from "./RecruitmentFormModal";
import { ScheduleFormModal } from "./ScheduleFormModal";
import { formatScheduleDate, todayInJst } from "./scheduleFormat";

/** 作成・編集モーダルの対象 */
type FormTarget = { mode: "create" } | { mode: "edit"; recruitment: RecruitmentDTO };

/**
 * 日程の追加・編集モーダルの対象
 *
 * `minDate` は日付の入力で選べる最も早い日。開いた時点の JST の今日にする。
 * 過去の日程を編集するときは、その日付も選べるようにする（日付を変えなければ過去の日程も編集できる）。
 */
type ScheduleFormTarget = { recruitmentId: string; minDate: string } & (
  | { mode: "create" }
  | { mode: "edit"; schedule: RecruitmentScheduleDTO }
);

/** 日程の削除の確認の対象 */
type ScheduleDeleteTarget = { recruitmentId: string; schedule: RecruitmentScheduleDTO };

/** 日程の API の URL */
function schedulesUrl(recruitmentId: string, scheduleId?: string): string {
  const base = `/api/my/recruitments/${encodeURIComponent(recruitmentId)}/schedules`;
  return scheduleId ? `${base}/${encodeURIComponent(scheduleId)}` : base;
}

/**
 * 書き込みの結果
 *
 * - `success`: 保存できた
 * - `gone`: 対象が見つからなかった（別のタブなどで消された）。一覧は取り直してある
 * - `failed`: それ以外の失敗（入力の誤り・通信の失敗など）
 */
type MutationResult = "success" | "gone" | "failed";

interface RecruitmentManagerProps {
  projectId: string;
}

/**
 * プロジェクトのサポート募集の管理（募集と日程の一覧・作成・編集・削除）
 *
 * 書き込みのたびに一覧を取り直す。同時に消された募集・日程は、取り直した一覧から消えるだけにする。
 */
export function RecruitmentManager({ projectId }: RecruitmentManagerProps) {
  const [recruitments, setRecruitments] = useState<RecruitmentDTO[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecruitmentDTO | null>(null);
  const [scheduleFormTarget, setScheduleFormTarget] = useState<ScheduleFormTarget | null>(null);
  const [scheduleDeleteTarget, setScheduleDeleteTarget] = useState<ScheduleDeleteTarget | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const { showToast } = useToast();

  const fetchRecruitments = useCallback(async () => {
    try {
      const res = await fetch(`/api/my/projects/${encodeURIComponent(projectId)}/recruitments`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message || "募集の取得に失敗しました");
        return;
      }
      setRecruitments(json.data.recruitments);
      setError(null);
    } catch {
      setError("募集の取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    // ProjectDetail と同じく、書き込みの後の再取得でも fetchRecruitments を使うので
    // useCallback に置き、effect 内の関数を経由して呼ぶ（react-hooks/set-state-in-effect 対策）
    async function load() {
      await fetchRecruitments();
    }
    void load();
  }, [fetchRecruitments]);

  /**
   * 書き込みの API を呼び、結果をトーストで知らせる。成功したとき・対象が無かったときは一覧を取り直す。
   */
  const mutate = async (
    url: string,
    method: "POST" | "PATCH" | "DELETE",
    successMessage: string,
    body?: unknown
  ): Promise<MutationResult> => {
    try {
      const res = await fetch(url, {
        method,
        ...(body !== undefined && {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        showToast(json?.error?.message || "保存に失敗しました", "error");
        if (res.status === 404) {
          await fetchRecruitments();
          return "gone";
        }
        return "failed";
      }
      showToast(successMessage, "success");
      await fetchRecruitments();
      return "success";
    } catch {
      showToast("保存に失敗しました", "error");
      return "failed";
    }
  };

  const handleFormSubmit = async (values: RecruitmentFormValues) => {
    if (!formTarget) return;
    const result =
      formTarget.mode === "create"
        ? await mutate(
            `/api/my/projects/${encodeURIComponent(projectId)}/recruitments`,
            "POST",
            "募集を作成しました",
            values
          )
        : await mutate(
            `/api/my/recruitments/${encodeURIComponent(formTarget.recruitment.id)}`,
            "PATCH",
            "募集を更新しました",
            values
          );
    if (result !== "failed") {
      setFormTarget(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    await mutate(
      `/api/my/recruitments/${encodeURIComponent(deleteTarget.id)}`,
      "DELETE",
      "募集を削除しました"
    );
    setIsDeleting(false);
    setDeleteTarget(null);
  };

  const openScheduleForm = (recruitmentId: string, schedule?: RecruitmentScheduleDTO) => {
    const today = todayInJst();
    setScheduleFormTarget(
      schedule
        ? {
            mode: "edit",
            recruitmentId,
            schedule,
            minDate: schedule.date < today ? schedule.date : today,
          }
        : { mode: "create", recruitmentId, minDate: today }
    );
  };

  const handleScheduleFormSubmit = async (values: ScheduleFormValues) => {
    if (!scheduleFormTarget) return;
    const result =
      scheduleFormTarget.mode === "create"
        ? await mutate(
            schedulesUrl(scheduleFormTarget.recruitmentId),
            "POST",
            "日程を追加しました",
            values
          )
        : await mutate(
            schedulesUrl(scheduleFormTarget.recruitmentId, scheduleFormTarget.schedule.id),
            "PATCH",
            "日程を更新しました",
            values
          );
    if (result !== "failed") {
      setScheduleFormTarget(null);
    }
  };

  const handleScheduleDelete = async () => {
    if (!scheduleDeleteTarget) return;
    setIsDeleting(true);
    await mutate(
      schedulesUrl(scheduleDeleteTarget.recruitmentId, scheduleDeleteTarget.schedule.id),
      "DELETE",
      "日程を削除しました"
    );
    setIsDeleting(false);
    setScheduleDeleteTarget(null);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <LoadingSpinner size="lg" message="読み込み中..." />
      </div>
    );
  }

  if (error || !recruitments) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-center">
        <p className="text-red-600">{error || "募集の取得に失敗しました"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600">
          サポーターに参加してほしい活動を募集として登録し、募集ごとに日程（日付・時間帯・定員）を追加します。公開中のプロジェクトでも、審査なしで作成・編集できます。
        </p>
        <Button
          variant="primary"
          size="sm"
          className="flex-shrink-0"
          onClick={() => setFormTarget({ mode: "create" })}
        >
          募集を作成
        </Button>
      </div>

      {recruitments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">まだ募集がありません</p>
          </CardContent>
        </Card>
      ) : (
        recruitments.map((recruitment) => (
          <RecruitmentCard
            key={recruitment.id}
            recruitment={recruitment}
            onEdit={() => setFormTarget({ mode: "edit", recruitment })}
            onDelete={() => setDeleteTarget(recruitment)}
            onAddSchedule={() => openScheduleForm(recruitment.id)}
            onEditSchedule={(schedule) => openScheduleForm(recruitment.id, schedule)}
            onDeleteSchedule={(schedule) =>
              setScheduleDeleteTarget({ recruitmentId: recruitment.id, schedule })
            }
          />
        ))
      )}

      {formTarget && (
        <RecruitmentFormModal
          heading={formTarget.mode === "create" ? "募集を作成" : "募集を編集"}
          submitLabel={formTarget.mode === "create" ? "作成する" : "保存する"}
          defaultValues={
            formTarget.mode === "edit"
              ? {
                  title: formTarget.recruitment.title,
                  description: formTarget.recruitment.description,
                }
              : undefined
          }
          onClose={() => setFormTarget(null)}
          onSubmit={handleFormSubmit}
        />
      )}

      {/* 削除中は閉じない（isDeleting は募集と日程の削除で共有している） */}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => {
          if (!isDeleting) setDeleteTarget(null);
        }}
        onConfirm={handleDelete}
        title="募集を削除"
        message={`「${deleteTarget?.title ?? ""}」を削除しますか？日程も一緒に削除され、元に戻せません。`}
        confirmLabel="削除する"
        cancelLabel="キャンセル"
        variant="danger"
        isLoading={isDeleting}
      />

      {scheduleFormTarget && (
        <ScheduleFormModal
          heading={scheduleFormTarget.mode === "create" ? "日程を追加" : "日程を編集"}
          submitLabel={scheduleFormTarget.mode === "create" ? "追加する" : "保存する"}
          defaultValues={
            scheduleFormTarget.mode === "edit"
              ? {
                  date: scheduleFormTarget.schedule.date,
                  startTime: scheduleFormTarget.schedule.startTime,
                  endTime: scheduleFormTarget.schedule.endTime,
                  capacityPerHour: scheduleFormTarget.schedule.capacityPerHour,
                  approvalMode: scheduleFormTarget.schedule.approvalMode,
                }
              : undefined
          }
          minDate={scheduleFormTarget.minDate}
          onClose={() => setScheduleFormTarget(null)}
          onSubmit={handleScheduleFormSubmit}
        />
      )}

      <ConfirmModal
        isOpen={scheduleDeleteTarget !== null}
        onClose={() => {
          if (!isDeleting) setScheduleDeleteTarget(null);
        }}
        onConfirm={handleScheduleDelete}
        title="日程を削除"
        message={
          scheduleDeleteTarget
            ? `${formatScheduleDate(scheduleDeleteTarget.schedule.date)} ${scheduleDeleteTarget.schedule.startTime}〜${scheduleDeleteTarget.schedule.endTime} の日程を削除しますか？元に戻せません。`
            : ""
        }
        confirmLabel="削除する"
        cancelLabel="キャンセル"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
