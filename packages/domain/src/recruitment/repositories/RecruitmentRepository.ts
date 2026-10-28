import type { ProjectId } from "../../project/value-objects/ProjectId";
import type { RecruitmentSchedule } from "../entities/RecruitmentSchedule";
import type { SupportRecruitment } from "../entities/SupportRecruitment";
import type { SupportRecruitmentId } from "../value-objects/SupportRecruitmentId";

/**
 * SupportRecruitment 集約のリポジトリ IF
 *
 * 集約は 1 つ（`SupportRecruitment` がルート、`RecruitmentSchedule` が子）だが、日程は変わった 1 件ずつ保存する。
 * 集約をまるごと保存すると、同じ募集に別々の日程を同時に追加したとき、後から保存した側が
 * 先に追加された日程を「消された」と見なして消してしまうため。
 * 日程のルール（同じ日付は 1 つ）は、保存する前に `SupportRecruitment` のメソッドで検証しておく。
 * 日程のメソッドには、ルートのメソッドが返した日程を渡す。実装は日程の ID と `supportRecruitmentId` の
 * 両方で行を絞り、別の募集の日程を書き換え・削除しないようにする。
 *
 * 読んでから保存するまでの間に、募集・日程・プロジェクトが別のリクエストで消されていたら、
 * 書き込みのメソッドは例外にせず何もしない（「保存した直後に消された」のと同じ結果になるため。#217）。
 *
 * application 層の port は、ここから必要なメソッドを `Pick` して組む（`02_domain-model.md` §8）。
 */
export interface RecruitmentRepository {
  /** 募集を日程ごと取得する。無ければ null。 */
  findById(id: SupportRecruitmentId): Promise<SupportRecruitment | null>;

  /** プロジェクトの募集を日程ごと取得する（作成日時の古い順）。 */
  findByProjectId(projectId: ProjectId): Promise<SupportRecruitment[]>;

  /** 新しい募集を、持っている日程ごと保存する。プロジェクトが消えていたら何もしない。 */
  create(recruitment: SupportRecruitment): Promise<void>;

  /** 募集自身の項目（タイトル・説明・updatedAt）を更新する。日程は書かない。募集が消えていたら何もしない。 */
  update(recruitment: SupportRecruitment): Promise<void>;

  /** 募集を削除する。日程も一緒に消える（DB の Cascade）。募集が消えていたら何もしない。 */
  delete(id: SupportRecruitmentId): Promise<void>;

  /**
   * 日程を 1 件追加する。募集が消えていたら何もしない。
   *
   * @throws ScheduleDateConflictError 同じ募集に同じ日付の日程がすでにある（同時に追加されたとき）
   */
  addSchedule(schedule: RecruitmentSchedule): Promise<void>;

  /**
   * 日程を 1 件更新する。日程が消えていたら何もしない。
   *
   * @throws ScheduleDateConflictError 変更後の日付の日程が、同じ募集にすでにある（同時に変更されたとき）
   */
  updateSchedule(schedule: RecruitmentSchedule): Promise<void>;

  /** 日程を 1 件削除する。日程が消えていたら何もしない。 */
  removeSchedule(schedule: RecruitmentSchedule): Promise<void>;
}
