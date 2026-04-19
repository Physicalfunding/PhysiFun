import type { OutboxStatus } from "@/lib/outbox";

const BADGE_STYLES: Record<OutboxStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  retrying: "bg-orange-100 text-orange-800",
  "dead-lettered": "bg-red-100 text-red-800",
  sent: "bg-green-100 text-green-800",
} as const;

const BADGE_LABELS: Record<OutboxStatus, string> = {
  pending: "未送信",
  retrying: "リトライ中",
  "dead-lettered": "デッドレター",
  sent: "送信済み",
} as const;

export function OutboxStatusBadge({ status }: { status: OutboxStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_STYLES[status]}`}
    >
      {BADGE_LABELS[status]}
    </span>
  );
}
