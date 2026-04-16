"use client";

import type { PublishStatus } from "@physifun/domain";
import { PUBLISH_STATUS_LABEL } from "@/lib/project-labels";

interface ProjectStatusBadgeProps {
  status: PublishStatus;
}

const STATUS_STYLES: Record<PublishStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PENDING_REVIEW: "bg-yellow-100 text-yellow-800",
  PUBLISHED: "bg-green-100 text-green-800",
};

export function ProjectStatusBadge({ status }: ProjectStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {PUBLISH_STATUS_LABEL[status]}
    </span>
  );
}
