"use client";

import { useCallback, useEffect, useState } from "react";
import type { RecruitmentDTO } from "@physifun/application";
import { Button, Card, CardContent, ConfirmModal, LoadingSpinner } from "@/components/common";
import { useToast } from "@/components/common/Toast";
import type { RecruitmentFormValues } from "@/lib/validations/recruitmentSchema";
import { RecruitmentCard } from "./RecruitmentCard";
import { RecruitmentFormModal } from "./RecruitmentFormModal";

/** 作成・編集モーダルの対象 */
type FormTarget = { mode: "create" } | { mode: "edit"; recruitment: RecruitmentDTO };

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
 * プロジェクトのサポート募集の管理（一覧・作成・編集・削除）
 *
 * 書き込みのたびに一覧を取り直す。同時に消された募集は、取り直した一覧から消えるだけにする。
 */
export function RecruitmentManager({ projectId }: RecruitmentManagerProps) {
  const [recruitments, setRecruitments] = useState<RecruitmentDTO[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecruitmentDTO | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { showToast } = useToast();

  const fetchRecruitments = useCallback(async () => {
    try {
      const res = await fetch(`/api/my/projects/${projectId}/recruitments`);
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
            `/api/my/projects/${projectId}/recruitments`,
            "POST",
            "募集を作成しました",
            values
          )
        : await mutate(
            `/api/my/recruitments/${formTarget.recruitment.id}`,
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
    await mutate(`/api/my/recruitments/${deleteTarget.id}`, "DELETE", "募集を削除しました");
    setIsDeleting(false);
    setDeleteTarget(null);
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
          サポーターに参加してほしい活動を、募集として登録します。公開中のプロジェクトでも、審査なしで作成・編集できます。
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

      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="募集を削除"
        message={`「${deleteTarget?.title ?? ""}」を削除しますか？日程も一緒に削除され、元に戻せません。`}
        confirmLabel="削除する"
        cancelLabel="キャンセル"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
