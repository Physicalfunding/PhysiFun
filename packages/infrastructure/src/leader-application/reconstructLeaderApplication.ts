import {
  LeaderApplication,
  type LeaderApplicationSnapshot,
  LeaderApplicationId,
  AccountId,
  type LeaderApplicationRecruitmentType,
  type LeaderApplicationStatus,
  type ProjectPhase,
  ProjectDraft,
  ProjectLocation,
  SnsLinks,
} from "@physifun/domain";

/**
 * Prisma の行データからドメインエンティティを復元する共通ヘルパー
 *
 * Approve/Reject の Port 実装で共用する。
 *
 * PR #198 review H2:
 * PR3〜PR5 で追加された応募フォーム拡張フィールド（progress / recruitmentTypes /
 * experienceOffered / phoneNumber / eventLocation / eventPeriod / recruitCount /
 * skillItemNeeds / skillItemDeadline / timeReturn / skillItemReturn）も
 * `LeaderApplication.snapshot` にスレッドし、round-trip を完全にする。
 */
export function reconstructLeaderApplication(row: {
  id: string;
  accountId: string;
  status: string;
  projectTitle: string;
  projectSummary: string;
  projectStory: string;
  projectCategory: string;
  prefectureCode: string;
  municipality: string | null;
  /** Issue #192 PR3 で `plannedActivities` から改名・nullable 化 */
  activityContent: string | null;
  snsLinks: unknown;
  submittedAt: Date;
  reviewedAt: Date | null;
  reviewerNote: string | null;
  // Issue #192 PR3〜PR5 拡張フィールド
  phoneNumber: string | null;
  progress: ProjectPhase;
  recruitmentTypes: readonly LeaderApplicationRecruitmentType[];
  /** Issue #192 PR #198 review M1: DB 上 NOT NULL */
  experienceOffered: string;
  eventLocation: string | null;
  eventPeriod: string | null;
  recruitCount: number | null;
  skillItemNeeds: string | null;
  skillItemDeadline: string | null;
  timeReturn: string | null;
  skillItemReturn: string | null;
}): LeaderApplication {
  const idResult = LeaderApplicationId.from(row.id);
  if (!idResult.ok) throw new Error(`Invalid LeaderApplicationId: ${row.id}`);

  const accountIdResult = AccountId.from(row.accountId);
  if (!accountIdResult.ok) throw new Error(`Invalid AccountId: ${row.accountId}`);

  const locationResult = ProjectLocation.create({
    prefectureCode: row.prefectureCode,
    municipality: row.municipality,
  });
  if (!locationResult.ok)
    throw new Error(`Invalid ProjectLocation: ${JSON.stringify(locationResult.error)}`);

  const snsRaw = (row.snsLinks ?? {}) as Record<string, string | null>;
  const snsResult = SnsLinks.create({
    x: snsRaw.x ?? null,
    instagram: snsRaw.instagram ?? null,
    facebook: snsRaw.facebook ?? null,
    website: snsRaw.website ?? null,
  });
  if (!snsResult.ok) throw new Error(`Invalid SnsLinks: ${JSON.stringify(snsResult.error)}`);

  const draftResult = ProjectDraft.create({
    projectTitle: row.projectTitle,
    projectSummary: row.projectSummary,
    projectStory: row.projectStory,
    projectCategory: row.projectCategory,
    location: locationResult.value,
    activityContent: row.activityContent,
    snsLinks: snsResult.value,
  });
  if (!draftResult.ok)
    throw new Error(`Invalid ProjectDraft: ${JSON.stringify(draftResult.error)}`);

  const snapshot: LeaderApplicationSnapshot = {
    phoneNumber: row.phoneNumber,
    progress: row.progress,
    recruitmentTypes: row.recruitmentTypes,
    experienceOffered: row.experienceOffered,
    eventLocation: row.eventLocation,
    eventPeriod: row.eventPeriod,
    recruitCount: row.recruitCount,
    timeReturn: row.timeReturn,
    skillItemNeeds: row.skillItemNeeds,
    skillItemDeadline: row.skillItemDeadline,
    skillItemReturn: row.skillItemReturn,
  };

  return LeaderApplication.reconstruct({
    id: idResult.value,
    accountId: accountIdResult.value,
    status: row.status as LeaderApplicationStatus,
    projectDraft: draftResult.value,
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt,
    reviewerNote: row.reviewerNote,
    snapshot,
  });
}
