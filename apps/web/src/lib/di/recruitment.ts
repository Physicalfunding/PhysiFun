import type {
  CreateRecruitmentPort,
  DeleteRecruitmentPort,
  ListRecruitmentsPort,
  UpdateRecruitmentPort,
} from "@physifun/application";
import { KyselyRecruitmentRepository } from "@physifun/infrastructure";

/**
 * 募集のユースケースが使う port をまとめた型
 */
export type RecruitmentPort = ListRecruitmentsPort &
  CreateRecruitmentPort &
  UpdateRecruitmentPort &
  DeleteRecruitmentPort;

/**
 * 募集のユースケース用のポート（Kysely 実装, #217）。
 *
 * `KyselyRecruitmentRepository` 1 つで、募集のユースケースの port をすべて満たす。
 * stateless なので DI 関数ごとにインスタンス化する。
 */
export function getRecruitmentPort(): RecruitmentPort {
  return new KyselyRecruitmentRepository();
}
