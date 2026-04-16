/**
 * ReviewAction
 *
 * 審査・状態遷移アクションの種別（運営操作のみ）。
 *
 * - `APPROVED`          : 運営承認（PENDING_REVIEW → PUBLISHED）
 * - `REJECTED`          : 運営差戻（PENDING_REVIEW → DRAFT）
 * - `FORCE_UNPUBLISHED` : 運営強制非公開（PUBLISHED → DRAFT）
 *
 * リーダーの自主取下げ（PENDING_REVIEW → DRAFT）は ReviewFeedback を作成しない。
 * ステータス変更自体が証跡となる。
 */
export const ReviewAction = {
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  FORCE_UNPUBLISHED: "FORCE_UNPUBLISHED",
} as const;

export type ReviewAction =
  (typeof ReviewAction)[keyof typeof ReviewAction];
