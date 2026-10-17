import { describe, expect, it } from "vitest";
import { getPublicPagePath } from "../publicPagePath";

describe("getPublicPagePath", () => {
  const slug = "0b6f3c2e-9d1a-4c7e-8f2b-1a2b3c4d5e6f";

  it("公開中で slug があれば /projects/{slug} を返す", () => {
    expect(getPublicPagePath("PUBLISHED", slug)).toBe(`/projects/${slug}`);
  });

  it("公開中でも slug が無ければ null", () => {
    expect(getPublicPagePath("PUBLISHED", null)).toBeNull();
  });

  it("非公開化して slug だけ残っている DRAFT は null", () => {
    expect(getPublicPagePath("DRAFT", slug)).toBeNull();
  });

  it("審査中（PENDING_REVIEW）は null", () => {
    expect(getPublicPagePath("PENDING_REVIEW", slug)).toBeNull();
  });
});
