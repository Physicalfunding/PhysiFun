import type { PublishStatus } from "@physifun/domain";
import { CATEGORY_MASTER, PROJECT_PHASE_LABELS } from "@physifun/domain";

/**
 * PublishStatus の日本語ラベル
 */
export const PUBLISH_STATUS_LABEL: Record<PublishStatus, string> = {
  DRAFT: "下書き",
  PENDING_REVIEW: "審査中",
  PUBLISHED: "公開中",
};

/**
 * ProjectPhase の日本語ラベル
 *
 * 単一情報源として domain の PROJECT_PHASE_LABELS を再エクスポート。
 * フロント表示は必ずこのラベル経由（Issue #192）。
 */
export const PROJECT_PHASE_LABEL = PROJECT_PHASE_LABELS;

/**
 * カテゴリ値 → ラベルのマッピング
 */
export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORY_MASTER.map((c) => [c.value, c.label])
);
