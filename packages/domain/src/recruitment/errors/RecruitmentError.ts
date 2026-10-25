/**
 * SupportRecruitment の項目（タイトル・説明）の検証エラー
 */
export type SupportRecruitmentUpdateError =
  | { readonly type: "TITLE_REQUIRED" }
  | {
      readonly type: "TITLE_TOO_LONG";
      readonly maxLength: number;
      readonly actualLength: number;
    }
  | { readonly type: "DESCRIPTION_REQUIRED" }
  | {
      readonly type: "DESCRIPTION_TOO_LONG";
      readonly maxLength: number;
      readonly actualLength: number;
    };

/**
 * 日程の追加・変更・削除のエラー
 */
export type RecruitmentScheduleError =
  | {
      readonly type: "DUPLICATE_SCHEDULE_DATE";
      readonly date: string;
    }
  | {
      readonly type: "SCHEDULE_NOT_FOUND";
      readonly scheduleId: string;
    };

/**
 * 日程を保存しようとしたら、同じ募集に同じ日付の日程がすでにあったときに、リポジトリがスローするエラー
 *
 * 日付の重複は `SupportRecruitment` が保存の前に検証している。それでも、同じ募集に同じ日付の日程を
 * 同時に追加すると、どちらも検証を通ってしまう。そのときは DB の unique 制約
 * （`supportRecruitmentId` + `date`）が止め、リポジトリがこのエラーに変える。
 */
export class ScheduleDateConflictError extends Error {
  constructor(readonly date: string) {
    super(`Schedule date conflict: ${date}`);
    this.name = "ScheduleDateConflictError";
  }
}
