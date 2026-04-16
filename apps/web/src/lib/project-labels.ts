import type { PublishStatus } from "@physifun/domain";
import type { ProjectPhase } from "@physifun/domain";
import { CATEGORY_MASTER } from "@physifun/domain";

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
 */
export const PROJECT_PHASE_LABEL: Record<ProjectPhase, string> = {
  VISION: "ビジョン",
  PLANNING: "企画",
  PREPARATION: "準備",
  EXECUTION: "実行",
  COMPLETED: "完了",
};

/**
 * カテゴリ値 → ラベルのマッピング
 */
export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORY_MASTER.map((c) => [c.value, c.label])
);
