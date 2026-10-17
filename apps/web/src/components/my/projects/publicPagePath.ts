/**
 * マイページから公開ページ `/projects/[slug]` へのリンク先を返す（#265）。
 *
 * 公開中（PUBLISHED）で slug があるときだけパスを返し、それ以外は null。
 * slug は非公開化しても残るため、status も見ないと 404 になるリンクを出してしまう。
 */
export function getPublicPagePath(status: string, slug: string | null): string | null {
  if (status !== "PUBLISHED" || !slug) return null;
  return `/projects/${slug}`;
}
