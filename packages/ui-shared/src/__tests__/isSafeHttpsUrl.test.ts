import { describe, expect, it } from "@jest/globals";
import { isSafeHttpsUrl } from "../isSafeHttpsUrl";

describe("isSafeHttpsUrl", () => {
  it("https スキームは許可する", () => {
    expect(isSafeHttpsUrl("https://example.com")).toBe(true);
    expect(isSafeHttpsUrl("https://example.com/path?q=1#frag")).toBe(true);
  });

  it("大文字の HTTPS も許可する", () => {
    // `new URL()` は scheme (protocol) を小文字に正規化するため、
    // `HTTPS://...` は `parsed.protocol === "https:"` の比較で自動的に許可される。
    // ここでは明示的にその挙動が回帰しないことを担保する。
    expect(isSafeHttpsUrl("HTTPS://example.com")).toBe(true);
  });

  it("http スキームは拒否する (Mixed Content 回避)", () => {
    expect(isSafeHttpsUrl("http://example.com")).toBe(false);
  });

  it("javascript: スキームは拒否する (XSS 対策)", () => {
    expect(isSafeHttpsUrl("javascript:alert(1)")).toBe(false);
  });

  it("data: スキームは拒否する", () => {
    expect(isSafeHttpsUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("vbscript: スキームは拒否する", () => {
    expect(isSafeHttpsUrl("vbscript:msgbox(1)")).toBe(false);
  });

  it("file: スキームは拒否する", () => {
    expect(isSafeHttpsUrl("file:///etc/passwd")).toBe(false);
  });

  it("不正な URL 文字列は拒否する", () => {
    expect(isSafeHttpsUrl("not-a-url")).toBe(false);
    expect(isSafeHttpsUrl("")).toBe(false);
    expect(isSafeHttpsUrl("   ")).toBe(false);
  });
});
