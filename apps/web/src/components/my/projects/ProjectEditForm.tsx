"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CATEGORY_MASTER } from "@physifun/domain";
import {
  Button,
  Card,
  CardContent,
  Input,
  Textarea,
  Select,
  LoadingSpinner,
} from "@/components/common";
import { useToast } from "@/components/common/Toast";
import { projectFormSchema, type ProjectFormValues } from "@/lib/validations/projectFormSchema";
import { PREFECTURES } from "@/lib/prefectures";

const PREFECTURE_OPTIONS = PREFECTURES.map((p) => ({
  value: p.code,
  label: p.name,
}));

const CATEGORY_OPTIONS = CATEGORY_MASTER.map((c) => ({
  value: c.value,
  label: c.label,
}));

interface ProjectEditFormProps {
  projectId: string;
}

export function ProjectEditForm({ projectId }: ProjectEditFormProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
  });

  useEffect(() => {
    async function fetchProject() {
      try {
        const res = await fetch(`/api/my/projects/${projectId}`);
        if (!res.ok) {
          setError("プロジェクトの取得に失敗しました");
          return;
        }
        const json = await res.json();
        const data = json.data;
        reset({
          title: data.title || "",
          summary: data.summary || "",
          body: data.body || "",
          leaderIntroduction: data.leaderIntroduction || "",
          activityPlan: data.activityPlan || "",
          coverImageUrl: data.coverImageUrl || "",
          category: data.category || "",
          prefectureCode: data.prefectureCode || "",
          municipality: data.municipality || "",
          snsLinks: {
            x: data.snsLinks?.x || "",
            instagram: data.snsLinks?.instagram || "",
            facebook: data.snsLinks?.facebook || "",
            website: data.snsLinks?.website || "",
          },
        });
      } catch {
        setError("プロジェクトの取得に失敗しました");
      } finally {
        setIsLoading(false);
      }
    }
    fetchProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const onSubmit = async (values: ProjectFormValues) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/my/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const json = await res.json();
        showToast(json.error?.message || "保存に失敗しました", "error");
        return;
      }
      const json = await res.json();
      if (json.data?.withdrawnFromPending) {
        showToast(
          "保存しました。審査中だったため、公開申請が自動的に取下げられました。",
          "warning"
        );
      } else {
        showToast("保存しました", "success");
      }
      router.push(`/my/projects/${projectId}`);
    } catch {
      showToast("保存に失敗しました", "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <LoadingSpinner size="lg" message="読み込み中..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-center">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* 基本情報 */}
      <Card>
        <CardContent>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">基本情報</h3>
          <div className="space-y-4">
            <Input label="タイトル" required error={errors.title?.message} {...register("title")} />
            <Textarea
              label="概要"
              rows={3}
              error={errors.summary?.message}
              {...register("summary")}
            />
            <Textarea
              label="プロジェクト詳細"
              rows={10}
              error={errors.body?.message}
              {...register("body")}
            />
            <Textarea
              label="リーダー紹介"
              rows={5}
              error={errors.leaderIntroduction?.message}
              {...register("leaderIntroduction")}
            />
            <Textarea
              label="活動計画"
              rows={5}
              error={errors.activityPlan?.message}
              {...register("activityPlan")}
            />
          </div>
        </CardContent>
      </Card>

      {/* カテゴリ・エリア */}
      <Card>
        <CardContent>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">カテゴリ・エリア</h3>
          <div className="space-y-4">
            <Select
              label="カテゴリ"
              options={CATEGORY_OPTIONS}
              placeholder="カテゴリを選択"
              error={errors.category?.message}
              {...register("category")}
            />
            <Select
              label="都道府県"
              options={[...PREFECTURE_OPTIONS]}
              placeholder="都道府県を選択"
              error={errors.prefectureCode?.message}
              {...register("prefectureCode")}
            />
            <Input
              label="市区町村"
              error={errors.municipality?.message}
              {...register("municipality")}
            />
          </div>
        </CardContent>
      </Card>

      {/* カバー画像 */}
      <Card>
        <CardContent>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">カバー画像</h3>
          <Input
            label="カバー画像URL"
            placeholder="https://example.com/image.jpg"
            error={errors.coverImageUrl?.message}
            {...register("coverImageUrl")}
          />
        </CardContent>
      </Card>

      {/* SNSリンク */}
      <Card>
        <CardContent>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">SNSリンク</h3>
          <div className="space-y-4">
            <Input
              label="X (Twitter)"
              placeholder="https://x.com/username"
              error={errors.snsLinks?.x?.message}
              {...register("snsLinks.x")}
            />
            <Input
              label="Instagram"
              placeholder="https://instagram.com/username"
              error={errors.snsLinks?.instagram?.message}
              {...register("snsLinks.instagram")}
            />
            <Input
              label="Facebook"
              placeholder="https://facebook.com/username"
              error={errors.snsLinks?.facebook?.message}
              {...register("snsLinks.facebook")}
            />
            <Input
              label="Webサイト"
              placeholder="https://example.com"
              error={errors.snsLinks?.website?.message}
              {...register("snsLinks.website")}
            />
          </div>
        </CardContent>
      </Card>

      {/* 送信ボタン */}
      <div className="flex gap-3 justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/my/projects/${projectId}`)}
        >
          キャンセル
        </Button>
        <Button type="submit" variant="primary" isLoading={isSaving}>
          保存
        </Button>
      </div>
    </form>
  );
}
