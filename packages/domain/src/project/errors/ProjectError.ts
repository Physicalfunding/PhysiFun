import type { PublishStatus } from "../value-objects/PublishStatus";

/**
 * Project 集約の状態遷移エラー
 */
export type ProjectStateError =
  | {
      readonly type: "CANNOT_REQUEST_PUBLISH_NON_DRAFT";
      readonly currentStatus: PublishStatus;
    }
  | {
      readonly type: "PUBLICATION_REQUIREMENTS_NOT_MET";
      readonly missingFields: readonly string[];
    }
  | {
      readonly type: "CANNOT_WITHDRAW_NON_PENDING";
      readonly currentStatus: PublishStatus;
    }
  | {
      readonly type: "CANNOT_APPROVE_NON_PENDING";
      readonly currentStatus: PublishStatus;
    }
  | {
      readonly type: "CANNOT_REJECT_NON_PENDING";
      readonly currentStatus: PublishStatus;
    }
  | {
      readonly type: "CANNOT_UNPUBLISH_NON_PUBLISHED";
      readonly currentStatus: PublishStatus;
    }
  | {
      readonly type: "CANNOT_FORCE_UNPUBLISH_NON_PUBLISHED";
      readonly currentStatus: PublishStatus;
    };

/**
 * Project フィールド更新エラー
 */
export type ProjectUpdateError =
  | { readonly type: "TITLE_REQUIRED" }
  | {
      readonly type: "TITLE_TOO_LONG";
      readonly maxLength: number;
      readonly actualLength: number;
    }
  | {
      readonly type: "SUMMARY_TOO_LONG";
      readonly maxLength: number;
      readonly actualLength: number;
    }
  | {
      readonly type: "BODY_TOO_LONG";
      readonly maxLength: number;
      readonly actualLength: number;
    }
  | {
      readonly type: "LEADER_INTRODUCTION_TOO_LONG";
      readonly maxLength: number;
      readonly actualLength: number;
    }
  | {
      readonly type: "ACTIVITY_PLAN_TOO_LONG";
      readonly maxLength: number;
      readonly actualLength: number;
    }
  | {
      readonly type: "PUBLICATION_REQUIREMENTS_NOT_MET";
      readonly missingFields: readonly string[];
    }
  | {
      readonly type: "INVALID_CATEGORY";
      readonly value: string;
    };
