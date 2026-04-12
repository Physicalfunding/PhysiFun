const BADGE_STYLES = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
} as const;

const BADGE_LABELS = {
  PENDING: "審査待ち",
  APPROVED: "承認済み",
  REJECTED: "却下済み",
} as const;

type Status = keyof typeof BADGE_STYLES;

export function ApplicationStatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_STYLES[status]}`}
    >
      {BADGE_LABELS[status]}
    </span>
  );
}
