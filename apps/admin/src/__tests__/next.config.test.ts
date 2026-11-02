import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

/**
 * セキュリティヘッダー（CSP）のテスト。`next.config.ts` の `headers()` を呼んで、全レスポンスに付く
 * Content-Security-Policy の値を確かめる。
 *
 * - `frame-src`（iframe で読み込めるホスト）は、審査画面のストーリーの YouTube の埋め込み（#321）だけ。
 *   ほかのホストが増えていないことを、値の全体で固定する
 */
async function cspDirective(name: string): Promise<readonly string[] | undefined> {
  const rules = (await nextConfig.headers?.()) ?? [];
  const csp = rules
    .flatMap((rule) => rule.headers)
    .find((header) => header.key === "Content-Security-Policy")?.value;
  const directive = csp
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `));
  return directive?.split(/\s+/).slice(1);
}

describe("next.config のセキュリティヘッダー", () => {
  it("frame-src は自サイトと YouTube（youtube-nocookie.com）だけ（#321）", async () => {
    expect(await cspDirective("frame-src")).toEqual(["'self'", "https://www.youtube-nocookie.com"]);
  });
});
