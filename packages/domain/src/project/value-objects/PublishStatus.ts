/**
 * PublishStatus
 *
 * プロジェクトの公開状態。
 *
 * - `DRAFT`          : 下書き。リーダーが自由に編集可能
 * - `PENDING_REVIEW`  : 公開申請中。運営による審査待ち
 * - `PUBLISHED`       : 公開済み。サポーターから閲覧可能
 */
export const PublishStatus = {
  DRAFT: "DRAFT",
  PENDING_REVIEW: "PENDING_REVIEW",
  PUBLISHED: "PUBLISHED",
} as const;

export type PublishStatus =
  (typeof PublishStatus)[keyof typeof PublishStatus];
