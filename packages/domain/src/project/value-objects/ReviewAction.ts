/**
 * ReviewAction
 *
 * 運営による審査アクションの種別。
 *
 * - `APPROVED`          : 承認（PENDING_REVIEW → PUBLISHED）
 * - `REJECTED`          : 差戻（PENDING_REVIEW → DRAFT）
 * - `FORCE_UNPUBLISHED` : 強制非公開（PUBLISHED → DRAFT）
 */
export const ReviewAction = {
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  FORCE_UNPUBLISHED: "FORCE_UNPUBLISHED",
} as const;

export type ReviewAction =
  (typeof ReviewAction)[keyof typeof ReviewAction];
