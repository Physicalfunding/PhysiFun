import type {
  AddSchedulePort,
  CreateRecruitmentPort,
  DeleteRecruitmentPort,
  ListRecruitmentsPort,
  RemoveSchedulePort,
  UpdateRecruitmentPort,
  UpdateSchedulePort,
} from "@physifun/application";
import { KyselyRecruitmentRepository } from "@physifun/infrastructure";

/**
 * 募集・日程のユースケースが使う port をまとめた型
 */
export type RecruitmentPort = ListRecruitmentsPort &
  CreateRecruitmentPort &
  UpdateRecruitmentPort &
  DeleteRecruitmentPort &
  AddSchedulePort &
  UpdateSchedulePort &
  RemoveSchedulePort;

/**
 * 募集・日程のユースケース用のポート（Kysely 実装, #217）。
 *
 * `KyselyRecruitmentRepository` 1 つで、募集・日程のユースケースの port をすべて満たす。
 * stateless なので DI 関数ごとにインスタンス化する。
 */
export function getRecruitmentPort(): RecruitmentPort {
  return new KyselyRecruitmentRepository();
}
