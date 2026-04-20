"use client";

import Image from "next/image";
import Link from "next/link";
import type { PublishStatus, ProjectPhase } from "@physifun/domain";
import { isAllowedImageUrl } from "@physifun/ui-shared";
import { Card } from "@/components/common";
import { PROJECT_PHASE_LABEL, CATEGORY_LABEL } from "@/lib/project-labels";
import { ProjectStatusBadge } from "./ProjectStatusBadge";

interface ProjectListItem {
  id: string;
  title: string;
  status: string;
  phase: string;
  category: string | null;
  coverImageUrl: string | null;
  updatedAt: string;
}

interface ProjectCardProps {
  project: ProjectListItem;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const formattedDate = new Date(project.updatedAt).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Link href={`/my/projects/${project.id}`}>
      <Card hover className="cursor-pointer">
        <div className="flex gap-4">
          {/* カバー画像 — Supabase Storage ホスト allowlist + SSRF 防御（Issue #120） */}
          <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-md bg-gray-100">
            {project.coverImageUrl && isAllowedImageUrl(project.coverImageUrl) ? (
              <Image
                src={project.coverImageUrl}
                alt={project.title}
                fill
                sizes="96px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-gray-400">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

          {/* 情報 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <ProjectStatusBadge status={project.status as PublishStatus} />
              <span className="text-xs text-gray-500">
                {PROJECT_PHASE_LABEL[project.phase as ProjectPhase]}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 truncate">{project.title}</h3>
            {project.category && (
              <p className="text-xs text-gray-500 mt-1">
                {CATEGORY_LABEL[project.category] || project.category}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">{formattedDate}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
