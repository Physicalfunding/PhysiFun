import { describe, expect, it } from "vitest";
import { PROJECT_STORY_LIMITS, ProjectStory } from "../value-objects/ProjectStory";

const STORAGE = "https://abc.supabase.co/storage/v1/object/public/project-images";
const isAllowedImageUrl = (url: string) => url.startsWith(`${STORAGE}/`);
const create = (value: unknown) => ProjectStory.create(value, { isAllowedImageUrl });

const doc = (...content: unknown[]) => ({ type: "doc", content });
const text = (value: string, marks?: unknown[]) => ({ type: "text", text: value, marks });
const p = (...content: unknown[]) => ({ type: "paragraph", content });
const h = (level: number, value: string) => ({
  type: "heading",
  attrs: { level },
  content: [text(value)],
});
const img = (src: string) => ({ type: "image", attrs: { src } });
const yt = (videoId: string) => ({ type: "youtube", attrs: { videoId } });
const li = (...content: unknown[]) => ({ type: "listItem", content });
const ul = (...items: unknown[]) => ({ type: "bulletList", content: items });

describe("ProjectStory", () => {
  describe("create", () => {
    it("許可した要素・装飾・属性だけの文書は通り、同じ内容で持つ", () => {
      const value = doc(
        { type: "heading", attrs: { level: 2, textAlign: "center" }, content: [text("見出し")] },
        h(3, "小見出し"),
        {
          type: "paragraph",
          attrs: { textAlign: "right" },
          content: [
            text("太字", [{ type: "bold" }, { type: "italic" }, { type: "strike" }]),
            { type: "hardBreak" },
            text("リンク", [{ type: "link", attrs: { href: "https://example.com/a?b=c" } }]),
            text("http", [{ type: "link", attrs: { href: "http://example.com" } }]),
          ],
        },
        ul(li(p(text("項目")), ul(li(p(text("入れ子")))))),
        { type: "orderedList", attrs: { start: 3 }, content: [li(p(text("番号")))] },
        { type: "image", attrs: { src: `${STORAGE}/a.webp`, alt: "代わりの文" } },
        yt("dQw4w9WgXcQ")
      );
      const result = create(value);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.toJSON()).toEqual(JSON.parse(JSON.stringify(value)));
    });

    it("作り直して凍結して持つので、元の値を変えても、持っている文書を書き換えようとしても変わらない", () => {
      const value = doc(p(text("元の文", [{ type: "link", attrs: { href: "https://a.jp" } }])));
      const result = create(value);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      value.content.push(img("https://evil.example.com/a.png"));
      const json = result.value.toJSON();
      expect(json.content).toHaveLength(1);
      const [paragraph] = json.content ?? [];
      const [inline] = paragraph?.type === "paragraph" ? (paragraph.content ?? []) : [];
      expect(() => {
        (json.content as unknown[]).push(img("https://evil.example.com/a.png"));
      }).toThrow(TypeError);
      expect(() => {
        (inline?.marks?.[0] as { attrs: { href: string } }).attrs.href = "javascript:alert(1)";
      }).toThrow(TypeError);
    });

    it("値が null の属性と空の marks は「指定なし」として省く", () => {
      const result = create(
        doc(
          { type: "paragraph", attrs: { textAlign: null }, content: [text("a", [])] },
          { type: "image", attrs: { src: `${STORAGE}/a.png`, alt: null } }
        )
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.toJSON()).toEqual(
          doc(
            { type: "paragraph", content: [{ type: "text", text: "a" }] },
            img(`${STORAGE}/a.png`)
          )
        );
      }
    });

    const link = (href: string) => doc(p(text("x", [{ type: "link", attrs: { href } }])));
    it.each([
      ["javascript: のリンク", link("javascript:alert(1)"), "INVALID_LINK_HREF"],
      ["大文字と空白でごまかした javascript:", link(" JavaScript:alert(1)"), "INVALID_LINK_HREF"],
      ["data: のリンク", link("data:text/html,<script>alert(1)</script>"), "INVALID_LINK_HREF"],
      ["相対 URL のリンク", link("/my/projects"), "INVALID_LINK_HREF"],
      [
        "リンクの target 属性",
        doc(p(text("x", [{ type: "link", attrs: { href: "https://a.jp", target: "_blank" } }]))),
        "UNSUPPORTED_ATTRIBUTE",
      ],
      ["外部ホストの画像", doc(img("https://evil.example.com/a.png")), "INVALID_IMAGE_SRC"],
      ["src の無い画像", doc({ type: "image", attrs: { alt: "a" } }), "INVALID_IMAGE_SRC"],
      [
        "YouTube の URL を ID の代わりに入れたもの",
        doc(yt("https://www.youtube.com/watch?v=dQw4w9WgXcQ")),
        "INVALID_YOUTUBE_ID",
      ],
      ["12 文字の YouTube ID", doc(yt("dQw4w9WgXcQQ")), "INVALID_YOUTUBE_ID"],
      [
        "YouTube 以外の埋め込み（iframe）",
        doc({ type: "iframe", attrs: { src: "https://evil.example.com" } }),
        "UNSUPPORTED_NODE",
      ],
      ["h1", doc(h(1, "大見出し")), "INVALID_ATTRIBUTE_VALUE"],
      [
        "両端そろえ",
        doc({ type: "paragraph", attrs: { textAlign: "justify" } }),
        "INVALID_ATTRIBUTE_VALUE",
      ],
      [
        "文字色",
        doc(p(text("赤", [{ type: "textStyle", attrs: { color: "#f00" } }]))),
        "UNSUPPORTED_MARK",
      ],
      [
        "style 属性",
        doc({ type: "paragraph", attrs: { style: "color:red" } }),
        "UNSUPPORTED_ATTRIBUTE",
      ],
      ["Object の組み込みの名前の要素", doc({ type: "constructor" }), "UNSUPPORTED_NODE"],
      ["段落の中の画像", doc(p(img(`${STORAGE}/a.png`))), "INVALID_STRUCTURE"],
      ["文書の直下の文字", doc(text("a")), "INVALID_STRUCTURE"],
      ["リストの直下の段落", doc(ul(p(text("a")))), "INVALID_STRUCTURE"],
      [
        "段落に付けた装飾",
        doc({ type: "paragraph", marks: [{ type: "bold" }] }),
        "INVALID_STRUCTURE",
      ],
      ["知らないキー（html）", doc({ type: "paragraph", html: "<b>a</b>" }), "INVALID_STRUCTURE"],
      ["空の文字", doc(p(text(""))), "INVALID_STRUCTURE"],
      ["文書でない最上位（段落）", p(text("a")), "INVALID_STRUCTURE"],
      ["オブジェクトでない値（文字列）", "<p>a</p>", "INVALID_STRUCTURE"],
      ["オブジェクトでない値（null）", null, "INVALID_STRUCTURE"],
    ])("%s を含む文書はエラー", (_, value, reason) => {
      const result = create(value);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatchObject({ type: "STORY_NOT_ALLOWED", reason });
    });

    it("エラーには問題のある場所が入る", () => {
      const result = create(doc(p(text("a")), img("https://evil.example.com/a.png")));
      expect(result).toEqual({
        ok: false,
        error: {
          type: "STORY_NOT_ALLOWED",
          reason: "INVALID_IMAGE_SRC",
          path: "$.content[1].attrs.src",
        },
      });
    });

    it("入れ子が深すぎる文書はエラー", () => {
      let list: unknown = ul(li(p(text("a"))));
      for (let i = 0; i < PROJECT_STORY_LIMITS.depth; i += 1) list = ul(li(list));
      const result = create(doc(list));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatchObject({ reason: "TOO_DEEP" });
    });

    describe("上限", () => {
      it("表示される文字は 10000 文字まで（見出しも数え、リンク先などの情報は数えない）", () => {
        const linked = (value: string) =>
          text(value, [
            { type: "link", attrs: { href: `https://example.com/${"x".repeat(500)}` } },
          ]);
        expect(create(doc(h(2, "a".repeat(5000)), p(linked("b".repeat(5000))))).ok).toBe(true);

        const result = create(doc(h(2, "a".repeat(5000)), p(linked("b".repeat(5001)))));
        expect(result).toEqual({
          ok: false,
          error: { type: "STORY_TOO_LONG", maxLength: 10000, actualLength: 10001 },
        });
      });

      it("画像は 20 枚まで", () => {
        const images = (n: number) =>
          Array.from({ length: n }, (_, i) => img(`${STORAGE}/${i}.png`));
        expect(create(doc(...images(20))).ok).toBe(true);
        expect(create(doc(...images(21)))).toEqual({
          ok: false,
          error: { type: "STORY_TOO_MANY_IMAGES", maxCount: 20, actualCount: 21 },
        });
      });

      it("動画は 5 本まで", () => {
        const videos = (n: number) => Array.from({ length: n }, () => yt("dQw4w9WgXcQ"));
        expect(create(doc(...videos(5))).ok).toBe(true);
        expect(create(doc(...videos(6)))).toEqual({
          ok: false,
          error: { type: "STORY_TOO_MANY_VIDEOS", maxCount: 5, actualCount: 6 },
        });
      });

      it("文書データ全体は 200 KB まで", () => {
        const result = create(
          doc({ type: "image", attrs: { src: `${STORAGE}/a.png`, alt: "a".repeat(210 * 1024) } })
        );
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toMatchObject({ type: "STORY_TOO_LARGE", maxBytes: 200 * 1024 });
        }
      });
    });
  });

  describe("fromPlainText", () => {
    it("1 行を 1 段落にし、空の行は段落の区切りとして捨てる", () => {
      const result = ProjectStory.fromPlainText("一行目\r\n二行目\n\n \n　字下げ\n");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.toJSON()).toEqual(
          doc(
            { type: "paragraph", content: [{ type: "text", text: "一行目" }] },
            { type: "paragraph", content: [{ type: "text", text: "二行目" }] },
            { type: "paragraph", content: [{ type: "text", text: "　字下げ" }] }
          )
        );
      }
    });

    it("空の本文は中身の無い文書になる", () => {
      const result = ProjectStory.fromPlainText("");
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.toJSON()).toEqual(doc());
    });

    it("10000 文字を超える本文はエラー", () => {
      const result = ProjectStory.fromPlainText("a".repeat(10001));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatchObject({ type: "STORY_TOO_LONG" });
    });
  });

  describe("isFilled", () => {
    const filled = (value: unknown) => {
      const result = create(value);
      if (!result.ok) throw new Error(JSON.stringify(result.error));
      return result.value.isFilled();
    };
    const headings = [h(2, "このプロジェクトで実現したいこと"), h(2, "立ち上げの背景")];

    it("見出しだけ・空白だけの文書は未入力", () => {
      expect(filled(doc())).toBe(false);
      expect(filled(doc(...headings))).toBe(false);
      expect(filled(doc(...headings, p(text(" 　")), p(), ul(li(p()))))).toBe(false);
    });

    it.each([
      ["段落の文字", p(text("畑を耕したい"))],
      ["リストの中の文字", ul(li(p(text("毎週土曜"))))],
      ["画像", img(`${STORAGE}/a.png`)],
      ["動画", yt("dQw4w9WgXcQ")],
    ])("見出しのほかに%sがあれば入力済み", (_, block) => {
      expect(filled(doc(...headings, block))).toBe(true);
    });
  });
});
