import {
  LeaderApplication,
  LeaderApplicationId,
  AccountId,
  type LeaderApplicationStatus,
  ProjectDraft,
  ProjectLocation,
  SnsLinks,
} from "@physifun/domain";

/**
 * Prisma の行データからドメインエンティティを復元する共通ヘルパー
 *
 * Approve/Reject の Port 実装で共用する。
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

  return LeaderApplication.reconstruct({
    id: idResult.value,
    accountId: accountIdResult.value,
    status: row.status as LeaderApplicationStatus,
    projectDraft: draftResult.value,
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt,
    reviewerNote: row.reviewerNote,
  });
}
