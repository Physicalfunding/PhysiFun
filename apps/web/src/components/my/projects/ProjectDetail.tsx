"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PREFECTURE_MASTER,
  type ProjectStoryDocument,
  type PublishStatus,
  type ProjectPhase,
} from "@physifun/domain";
import { isAllowedImageUrl } from "@physifun/ui-shared";
import { Button, Card, CardContent, LoadingSpinner, ConfirmModal } from "@/components/common";
import { ProjectHomePanel } from "@/components/project/ProjectHomePanel";
import { ProjectPublicTabs } from "@/components/project/ProjectPublicTabs";
import { useToast } from "@/components/common/Toast";
import { PROJECT_PHASE_LABEL, CATEGORY_LABEL } from "@/lib/project-labels";
import { ProjectStatusBadge } from "./ProjectStatusBadge";
import { PendingReviewBanner } from "./PendingReviewBanner";
import { getPublicPagePath } from "./publicPagePath";

const PREFECTURE_MAP: Record<string, string> = Object.fromEntries(
  PREFECTURE_MASTER.map((p) => [p.code, p.name])
);

interface ProjectDetailDTO {
  id: string;
  title: string;
  summary: string | null;
  body: ProjectStoryDocument | null;
  leaderIntroduction: string | null;
  coverImageUrl: string | null;
  category: string | null;
  prefectureCode: string | null;
  municipality: string | null;
  snsLinks: {
    x: string | null;
    instagram: string | null;
    facebook: string | null;
    website: string | null;
  };
  status: string;
  phase: string;
  activityPlan: string | null;
  slug: string | null;
  createdAt: string;
  updatedAt: string;
  latestFeedback: {
    action: string;
    note: string | null;
    reviewedAt: string;
  } | null;
  leader: {
    displayName: string;
    bio: string | null;
  };
}

interface ProjectDetailProps {
  projectId: string;
}

/** 未実装タブ向けの「準備中」パネル */
const placeholderPanel = (
  <Card>
    <CardContent className="py-12 text-center">
      <p className="text-gray-500">準備中</p>
    </CardContent>
  </Card>
);

export function ProjectDetail({ projectId }: ProjectDetailProps) {
  const [project, setProject] = useState<ProjectDetailDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPublishConfirmOpen, setIsPublishConfirmOpen] = useState(false);
  const [isUnpublishConfirmOpen, setIsUnpublishConfirmOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const { showToast } = useToast();
  const router = useRouter();

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/my/projects/${projectId}`);
      if (!res.ok) {
        setError("プロジェクトの取得に失敗しました");
        return;
      }
      const json = await res.json();
      setProject(json.data);
    } catch {
      setError("プロジェクトの取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    // setState は fetch の await 後にしか走らないが、react-hooks/set-state-in-effect は
    // useCallback 越しには判定できないため、effect 内に宣言した関数を経由して呼ぶ
    //（他の画面は fetch 自体を effect 内の関数に書いている。ここは公開申請後の
    // 再取得でも fetchProject を使うので useCallback に残している）。
    async function load() {
      await fetchProject();
    }
    void load();
  }, [fetchProject]);

  const handleRequestPublish = async () => {
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/my/projects/${projectId}/request-publish`, {
        method: "POST",
      });
      if (!res.ok) {
        const json = await res.json();
        showToast(json.error?.message || "公開申請に失敗しました", "error");
        return;
      }
      showToast("公開申請を送信しました", "success");
      await fetchProject();
    } catch {
      showToast("公開申請に失敗しました", "error");
    } finally {
      setIsActionLoading(false);
      setIsPublishConfirmOpen(false);
    }
  };

  const handleUnpublish = async () => {
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/my/projects/${projectId}/unpublish`, {
        method: "POST",
      });
      if (!res.ok) {
        const json = await res.json();
        showToast(json.error?.message || "非公開化に失敗しました", "error");
        return;
      }
      showToast("プロジェクトを非公開にしました", "success");
      await fetchProject();
    } catch {
      showToast("非公開化に失敗しました", "error");
    } finally {
      setIsActionLoading(false);
      setIsUnpublishConfirmOpen(false);
    }
  };

  const handleWithdraw = () => {
    fetchProject();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <LoadingSpinner size="lg" message="読み込み中..." />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-center">
        <p className="text-red-600">{error || "プロジェクトが見つかりません"}</p>
      </div>
    );
  }

  const status = project.status as PublishStatus;
  const phase = project.phase as ProjectPhase;
  const publicPagePath = getPublicPagePath(status, project.slug);

  const locationParts: string[] = [];
  if (project.prefectureCode && PREFECTURE_MAP[project.prefectureCode]) {
    locationParts.push(PREFECTURE_MAP[project.prefectureCode]);
  }
  if (project.municipality) {
    locationParts.push(project.municipality);
  }
  const locationText = locationParts.join(" ");

  return (
    <div className="space-y-6">
      {/* PENDING_REVIEW バナー */}
      {status === "PENDING_REVIEW" && (
        <PendingReviewBanner projectId={projectId} onWithdraw={handleWithdraw} />
      )}

      {/* ヘッダーセクション */}
      <Card>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row">
            {/* カバー画像 — Supabase Storage ホスト allowlist + SSRF 防御（Issue #120） */}
            <div className="relative h-48 w-full flex-shrink-0 overflow-hidden rounded-lg bg-gray-100 sm:h-36 sm:w-48">
              {project.coverImageUrl && isAllowedImageUrl(project.coverImageUrl) ? (
                <Image
                  src={project.coverImageUrl}
                  alt={project.title}
                  fill
                  sizes="(min-width: 640px) 192px, 100vw"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-gray-400">
                  <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              )}
            </div>

            {/* プロジェクト情報 */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <ProjectStatusBadge status={status} />
                <span className="text-sm text-gray-500">{PROJECT_PHASE_LABEL[phase]}</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">{project.title}</h1>
              {project.category && (
                <p className="text-sm text-gray-500 mt-1">
                  {CATEGORY_LABEL[project.category] || project.category}
                </p>
              )}
              {locationText && <p className="text-sm text-gray-500 mt-1">{locationText}</p>}
              {/* 概要はタイトルの下の短い紹介文として出す（公開ページと同じ。設計書 §5.6） */}
              {project.summary && (
                <p className="mt-2 border-l-4 border-orange-500 pl-3 text-sm text-gray-600 whitespace-pre-wrap">
                  {project.summary}
                </p>
              )}
            </div>
          </div>

          {/* アクションボタン */}
          <div className="mt-4 flex gap-3">
            {status === "DRAFT" && (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => router.push(`/my/projects/${projectId}/edit`)}
                >
                  編集
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPublishConfirmOpen(true)}
                  isLoading={isActionLoading}
                  data-testid="request-publish-button"
                >
                  公開申請
                </Button>
              </>
            )}
            {status === "PUBLISHED" && (
              <>
                <div className="relative group">
                  <Button variant="primary" size="sm" disabled>
                    編集
                  </Button>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block">
                    <div className="rounded bg-gray-900 px-2 py-1 text-xs text-white whitespace-nowrap">
                      公開中は編集できません
                    </div>
                  </div>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setIsUnpublishConfirmOpen(true)}
                  isLoading={isActionLoading}
                >
                  非公開にする
                </Button>
              </>
            )}
            {publicPagePath && (
              <Link href={publicPagePath} data-testid="public-page-link">
                <Button variant="outline" size="sm">
                  公開ページを見る
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* フィードバック */}
      {project.latestFeedback && (
        <Card>
          <CardContent>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">最新のフィードバック</h3>
            {project.latestFeedback.note && (
              <p className="text-sm text-gray-700">{project.latestFeedback.note}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {new Date(project.latestFeedback.reviewedAt).toLocaleDateString("ja-JP", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </CardContent>
        </Card>
      )}

      {/* タブ（公開ページと同じ部品。「ホーム」の中身も公開ページと共有して、読む人と同じ見え方を確かめられるようにする） */}
      <ProjectPublicTabs
        home={
          <ProjectHomePanel
            body={project.body}
            leaderIntroduction={project.leaderIntroduction}
            leader={project.leader}
            snsLinks={project.snsLinks}
            activityPlan={project.activityPlan}
            emptyState={
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-gray-500">まだストーリーがありません</p>
                  {status === "DRAFT" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => router.push(`/my/projects/${projectId}/edit`)}
                    >
                      編集する
                    </Button>
                  )}
                </CardContent>
              </Card>
            }
          />
        }
        support={
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">
                サポーターに参加してほしい活動を、募集として登録できます
              </p>
              <Link
                href={`/my/projects/${projectId}/recruitments`}
                data-testid="manage-recruitments-link"
              >
                <Button variant="primary" size="sm" className="mt-3">
                  募集を管理する
                </Button>
              </Link>
            </CardContent>
          </Card>
        }
        report={placeholderPanel}
        supporters={placeholderPanel}
      />

      {/* 確認モーダル */}
      <ConfirmModal
        isOpen={isPublishConfirmOpen}
        onClose={() => setIsPublishConfirmOpen(false)}
        onConfirm={handleRequestPublish}
        title="公開申請"
        message="プロジェクトの公開を申請しますか？審査が完了するまで編集できなくなります。"
        confirmLabel="申請する"
        cancelLabel="キャンセル"
        variant="primary"
        isLoading={isActionLoading}
      />
      <ConfirmModal
        isOpen={isUnpublishConfirmOpen}
        onClose={() => setIsUnpublishConfirmOpen(false)}
        onConfirm={handleUnpublish}
        title="非公開にする"
        message="プロジェクトを非公開にしますか？公開ページからアクセスできなくなります。"
        confirmLabel="非公開にする"
        cancelLabel="キャンセル"
        variant="danger"
        isLoading={isActionLoading}
      />
    </div>
  );
}
