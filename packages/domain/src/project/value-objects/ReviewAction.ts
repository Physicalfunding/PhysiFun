/**
 * ReviewAction
 *
 * 審査・状態遷移アクションの種別。
 *
 * - `APPROVED`          : 運営承認（PENDING_REVIEW → PUBLISHED）
 * - `REJECTED`          : 運営差戻（PENDING_REVIEW → DRAFT）
 * - `FORCE_UNPUBLISHED` : 運営強制非公開（PUBLISHED → DRAFT）
 * - `WITHDRAWN`         : リーダー自主取下げ（PENDING_REVIEW → DRAFT、編集による自動取下げ含む）
 */
export const ReviewAction = {
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  FORCE_UNPUBLISHED: "FORCE_UNPUBLISHED",
  WITHDRAWN: "WITHDRAWN",
} as const;

export type ReviewAction =
  (typeof ReviewAction)[keyof typeof ReviewAction];
