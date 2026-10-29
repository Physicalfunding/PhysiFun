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
      readonly type: "CANNOT_UPDATE_PUBLISHED_MISSING_FIELDS";
      readonly missingFields: readonly string[];
    }
  | {
      readonly type: "INVALID_CATEGORY";
      readonly value: string;
    };

/**
 * ストーリー（本文の文書データ）に許可していないものが含まれる理由
 */
export type StoryNotAllowedReason =
  /** 文書データの形になっていない（オブジェクトでない・知らないキー・置けない場所にある要素など） */
  | "INVALID_STRUCTURE"
  /** 入れ子が深すぎる */
  | "TOO_DEEP"
  /** 許可していない要素（h1 は見出しの level で INVALID_ATTRIBUTE_VALUE になる） */
  | "UNSUPPORTED_NODE"
  /** 許可していない装飾（文字色など） */
  | "UNSUPPORTED_MARK"
  /** 許可していない属性 */
  | "UNSUPPORTED_ATTRIBUTE"
  /** 属性の値が許可した範囲にない（見出しの level・配置など） */
  | "INVALID_ATTRIBUTE_VALUE"
  /** リンク先が http / https でない */
  | "INVALID_LINK_HREF"
  /** 画像が自サイトの Storage の URL でない */
  | "INVALID_IMAGE_SRC"
  /** YouTube の動画 ID の形でない */
  | "INVALID_YOUTUBE_ID";

/**
 * ストーリー（本文の文書データ）の検査エラー
 */
export type ProjectStoryError =
  | {
      readonly type: "STORY_NOT_ALLOWED";
      readonly reason: StoryNotAllowedReason;
      /** 問題のある場所（例: `$.content[2].attrs.src`） */
      readonly path: string;
    }
  | {
      readonly type: "STORY_TOO_LONG";
      readonly maxLength: number;
      readonly actualLength: number;
    }
  | {
      readonly type: "STORY_TOO_MANY_IMAGES";
      readonly maxCount: number;
      readonly actualCount: number;
    }
  | {
      readonly type: "STORY_TOO_MANY_VIDEOS";
      readonly maxCount: number;
      readonly actualCount: number;
    }
  | {
      readonly type: "STORY_TOO_LARGE";
      readonly maxBytes: number;
      readonly actualBytes: number;
    };
