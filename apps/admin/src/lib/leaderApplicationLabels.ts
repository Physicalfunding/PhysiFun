import {
  LEADER_APPLICATION_RECRUITMENT_TYPE_LABELS,
  type LeaderApplicationRecruitmentType,
} from "@physifun/domain";

/**
 * 募集タイプコードからラベルへ変換する。
 *
 * ラベル本体は SSOT として `@physifun/domain` の
 * `LEADER_APPLICATION_RECRUITMENT_TYPE_LABELS` 側で管理する
 * (`PROJECT_PHASE_LABELS` と同じレイヤー)。
 */
export function getRecruitmentTypeLabel(type: LeaderApplicationRecruitmentType): string {
  return LEADER_APPLICATION_RECRUITMENT_TYPE_LABELS[type];
}
