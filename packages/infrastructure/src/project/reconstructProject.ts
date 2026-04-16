import {
  Project,
  ProjectId,
  AccountId,
  ProjectPhase,
  PublishStatus,
  ProjectLocation,
  SnsLinks,
  type ProjectCategory,
  isProjectCategory,
} from "@physifun/domain";

/**
 * Prisma の Project 行データからドメインエンティティを復元する共通ヘルパー
 *
 * フィールドマッピング:
 * - Prisma `story` → Domain `body`
 * - Prisma `leaderIntro` → Domain `leaderIntroduction`
 * - Prisma `status` → Domain `publishStatus`
 */
export function reconstructProject(row: {
  id: string;
  ownerAccountId: string;
  title: string;
  coverImageUrl: string | null;
  category: string | null;
  prefectureCode: string | null;
  municipality: string | null;
  phase: string;
  status: string;
  summary: string | null;
  story: string | null;
  leaderIntro: string | null;
  snsLinks: unknown;
  activityPlan: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Project {
  const idResult = ProjectId.from(row.id);
  if (!idResult.ok) throw new Error(`Invalid ProjectId: ${row.id}`);

  const accountIdResult = AccountId.from(row.ownerAccountId);
  if (!accountIdResult.ok) throw new Error(`Invalid AccountId: ${row.ownerAccountId}`);

  // category
  let category: ProjectCategory | null = null;
  if (row.category !== null) {
    if (!isProjectCategory(row.category)) {
      throw new Error(`Invalid ProjectCategory: ${row.category}`);
    }
    category = row.category;
  }

  // location
  let location: ProjectLocation | null = null;
  if (row.prefectureCode !== null) {
    const locationResult = ProjectLocation.create({
      prefectureCode: row.prefectureCode,
      municipality: row.municipality,
    });
    if (!locationResult.ok) {
      throw new Error(`Invalid ProjectLocation: ${JSON.stringify(locationResult.error)}`);
    }
    location = locationResult.value;
  }

  // snsLinks
  const snsRaw = (row.snsLinks ?? {}) as Record<string, string | null>;
  const snsResult = SnsLinks.create({
    x: snsRaw.x ?? null,
    instagram: snsRaw.instagram ?? null,
    facebook: snsRaw.facebook ?? null,
    website: snsRaw.website ?? null,
  });
  if (!snsResult.ok) throw new Error(`Invalid SnsLinks: ${JSON.stringify(snsResult.error)}`);

  return Project.reconstruct({
    id: idResult.value,
    ownerAccountId: accountIdResult.value,
    title: row.title,
    coverImageUrl: row.coverImageUrl,
    category,
    location,
    phase: row.phase as ProjectPhase,
    publishStatus: row.status as PublishStatus,
    summary: row.summary,
    body: row.story,
    leaderIntroduction: row.leaderIntro,
    snsLinks: snsResult.value,
    activityPlan: row.activityPlan,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
