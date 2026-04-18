import type { PublishStatus } from "@physifun/domain";

const BADGE_STYLES: Record<PublishStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  PENDING_REVIEW: "bg-yellow-100 text-yellow-800",
  PUBLISHED: "bg-green-100 text-green-800",
};

const BADGE_LABELS: Record<PublishStatus, string> = {
  DRAFT: "下書き",
  PENDING_REVIEW: "審査待ち",
  PUBLISHED: "公開中",
};

/**
 * PublishStatus バッジ (DRAFT / PENDING_REVIEW / PUBLISHED)
 */
export function ProjectPublishStatusBadge({ status }: { status: PublishStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_STYLES[status]}`}
    >
      {BADGE_LABELS[status]}
    </span>
  );
}
