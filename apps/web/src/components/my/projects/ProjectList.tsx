"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, LoadingSpinner, Modal, Input } from "@/components/common";
import { useToast } from "@/components/common/Toast";
import { ProjectCard } from "./ProjectCard";

interface ProjectListItem {
  id: string;
  title: string;
  status: string;
  phase: string;
  category: string | null;
  coverImageUrl: string | null;
  updatedAt: string;
}

export function ProjectList() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const { showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch("/api/my/projects");
        if (!res.ok) {
          setError("プロジェクト一覧の取得に失敗しました");
          return;
        }
        const json = await res.json();
        setProjects(json.data?.items || []);
      } catch {
        setError("プロジェクト一覧の取得に失敗しました");
      } finally {
        setIsLoading(false);
      }
    }
    fetchProjects();
  }, []);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;

    setIsCreating(true);
    try {
      const res = await fetch("/api/my/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (!res.ok) {
        const json = await res.json();
        showToast(json.error?.message || "プロジェクトの作成に失敗しました", "error");
        return;
      }
      const json = await res.json();
      const projectId = json.data?.id;
      if (projectId) {
        showToast("プロジェクトを作成しました", "success");
        router.push(`/my/projects/${projectId}/edit`);
      }
    } catch {
      showToast("プロジェクトの作成に失敗しました", "error");
    } finally {
      setIsCreating(false);
      setIsCreateModalOpen(false);
      setNewTitle("");
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">マイプロジェクト</h2>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsCreateModalOpen(true)}
          data-testid="create-project-button"
        >
          新規プロジェクト作成
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500">プロジェクトがまだありません</p>
          <p className="mt-2 text-sm text-gray-400">
            「新規プロジェクト作成」ボタンから最初のプロジェクトを作成しよう
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setNewTitle("");
        }}
        title="新規プロジェクト作成"
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="プロジェクトタイトル"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="プロジェクトのタイトルを入力"
            required
            onKeyDown={(e) => {
              if (e.key === "Enter" && newTitle.trim()) {
                handleCreate();
              }
            }}
          />
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsCreateModalOpen(false);
                setNewTitle("");
              }}
            >
              キャンセル
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreate}
              disabled={!newTitle.trim()}
              isLoading={isCreating}
              data-testid="confirm-create-project"
            >
              作成
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
