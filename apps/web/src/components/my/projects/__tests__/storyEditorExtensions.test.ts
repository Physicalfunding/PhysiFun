import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { ProjectStory } from "@physifun/domain";
import { describe, expect, it } from "vitest";
import { canEditStory, isStoryLinkUrl, storyEditorExtensions } from "../storyEditorExtensions";

/**
 * Issue #317: ストーリーのエディタの拡張の組み合わせのテスト。
 *
 * エディタの画面（DOM）は要らず、拡張から組み立てたスキーマ（`getSchema`）で、出せる要素・装飾・属性が
 * domain の `ProjectStory` の許可するものと一致することを確かめる。
 * `schema.nodeFromJSON(json).toJSON()` は、エディタの `getJSON()` と同じ形（既定の属性も含む）になる
 */
const schema = getSchema(storyEditorExtensions);
const create = (value: unknown) => ProjectStory.create(value, { isAllowedImageUrl: () => false });

const text = (value: string, marks?: unknown[]) => ({ type: "text", text: value, marks });
const li = (value: string) => ({
  type: "listItem",
  content: [{ type: "paragraph", content: [text(value)] }],
});

describe("storyEditorExtensions", () => {
  it("出せる要素は domain が許可するもの（画像・YouTube 以外）だけ", () => {
    expect(Object.keys(schema.nodes).sort()).toEqual([
      "bulletList",
      "doc",
      "hardBreak",
      "heading",
      "listItem",
      "orderedList",
      "paragraph",
      "text",
    ]);
  });

  it("出せる装飾は太字・斜体・取り消し線・リンクだけ（下線・コード・文字色は無い）", () => {
    expect(Object.keys(schema.marks).sort()).toEqual(["bold", "italic", "link", "strike"]);
  });

  it("見出しは h2 / h3 だけを読む（h1 は貼り付けても見出しにならない）", () => {
    const tags = schema.nodes.heading.spec.parseDOM?.map((rule) =>
      "tag" in rule ? rule.tag : undefined
    );
    expect(tags).toEqual(["h2", "h3"]);
  });

  it("リンクの属性は href だけ、番号付きリストの属性は start だけ（Tiptap が既定で足す属性は出さない）", () => {
    expect(Object.keys(schema.marks.link.spec.attrs ?? {})).toEqual(["href"]);
    expect(Object.keys(schema.nodes.orderedList.spec.attrs ?? {})).toEqual(["start"]);
  });

  it("貼り付けた <ol> の start は、domain が断る値（数字でない・負数）なら 1 にする", () => {
    // parseDOM の規則に、最小限の要素のふりをしたオブジェクトを渡す（start だけを読む）
    const rule = schema.nodes.orderedList.spec.parseDOM?.[0];
    const parse = (start: string | null) =>
      rule && "getAttrs" in rule && typeof rule.getAttrs === "function"
        ? rule.getAttrs({ getAttribute: () => start } as unknown as HTMLElement)
        : undefined;
    expect(parse("3")).toEqual({ start: 3 });
    expect(parse("0")).toEqual({ start: 0 });
    expect(parse(null)).toEqual({ start: 1 });
    expect(parse("abc")).toEqual({ start: 1 });
    expect(parse("-3")).toEqual({ start: 1 });
  });

  it("配置は段落と見出しだけに付き、left / center / right だけ（両端そろえは無い）", () => {
    expect(schema.nodes.paragraph.spec.attrs).toHaveProperty("textAlign");
    expect(schema.nodes.heading.spec.attrs).toHaveProperty("textAlign");
    expect(schema.nodes.listItem.spec.attrs ?? {}).not.toHaveProperty("textAlign");
    const textAlign = storyEditorExtensions.find((extension) => extension.name === "textAlign");
    expect(textAlign?.options).toMatchObject({
      types: ["heading", "paragraph"],
      alignments: ["left", "center", "right"],
    });
  });

  it("エディタの JSON（見出し・配置・太字・斜体・取り消し線・改行・リンク・リスト）が ProjectStory の検査を通る", () => {
    const json = schema
      .nodeFromJSON({
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2, textAlign: "center" },
            content: [text("実現したいこと")],
          },
          { type: "heading", attrs: { level: 3 }, content: [text("小見出し")] },
          {
            type: "paragraph",
            attrs: { textAlign: "right" },
            content: [
              text("太字", [{ type: "bold" }]),
              text("斜体", [{ type: "italic" }]),
              text("取り消し", [{ type: "strike" }]),
              { type: "hardBreak" },
              text("リンク", [{ type: "link", attrs: { href: "https://example.com/a" } }]),
            ],
          },
          { type: "bulletList", content: [li("項目")] },
          { type: "orderedList", attrs: { start: 3 }, content: [li("番号")] },
        ],
      })
      .toJSON();

    // エディタは既定の属性（指定なしの配置 = null、番号付きリストの start）を埋める
    expect(json.content[1].attrs).toEqual({ level: 3, textAlign: null });
    expect(json.content[3].content[0].content[0].attrs).toEqual({ textAlign: null });

    const result = create(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // null の属性は「指定なし」として省かれ、リンクは href だけで持つ
    expect(result.value.toJSON()).toEqual({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2, textAlign: "center" },
          content: [{ type: "text", text: "実現したいこと" }],
        },
        { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "小見出し" }] },
        {
          type: "paragraph",
          attrs: { textAlign: "right" },
          content: [
            { type: "text", text: "太字", marks: [{ type: "bold" }] },
            { type: "text", text: "斜体", marks: [{ type: "italic" }] },
            { type: "text", text: "取り消し", marks: [{ type: "strike" }] },
            { type: "hardBreak" },
            {
              type: "text",
              text: "リンク",
              marks: [{ type: "link", attrs: { href: "https://example.com/a" } }],
            },
          ],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "項目" }] }],
            },
          ],
        },
        {
          type: "orderedList",
          attrs: { start: 3 },
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "番号" }] }],
            },
          ],
        },
      ],
    });
  });

  it("Tiptap の既定の Link のままだと、target などの属性で ProjectStory に断られる（絞る理由）", () => {
    const json = getSchema([StarterKit])
      .nodeFromJSON({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [text("a", [{ type: "link", attrs: { href: "https://example.com" } }])],
          },
        ],
      })
      .toJSON();
    const result = create(json);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatchObject({
        type: "STORY_NOT_ALLOWED",
        reason: "UNSUPPORTED_ATTRIBUTE",
      });
    }
  });
});

describe("canEditStory", () => {
  it("本文が無いとき・許可した要素だけの本文は編集できる", () => {
    expect(canEditStory(null)).toBe(true);
    expect(
      canEditStory({
        type: "doc",
        content: [
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "見出し" }] },
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [{ type: "paragraph", content: [{ type: "text", text: "項目" }] }],
              },
            ],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "a",
                marks: [{ type: "link", attrs: { href: "https://example.com" } }],
              },
            ],
          },
        ],
      })
    ).toBe(true);
  });

  it("domain は許すがこのエディタにまだ無い要素（YouTube・画像）を含む本文は編集できない（空で開いて消さないため）", () => {
    expect(
      canEditStory({
        type: "doc",
        content: [{ type: "youtube", attrs: { videoId: "dQw4w9WgXcQ" } }],
      })
    ).toBe(false);
    expect(
      canEditStory({
        type: "doc",
        content: [{ type: "image", attrs: { src: "https://abc.supabase.co/a.png" } }],
      })
    ).toBe(false);
  });

  it("置けない場所にある要素（リストの直下の段落）も編集できない", () => {
    expect(
      canEditStory({
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }],
          },
        ],
      })
    ).toBe(false);
  });
});

describe("isStoryLinkUrl", () => {
  it.each(["https://example.com/a?b=c#d", "http://example.com", "HTTPS://EXAMPLE.COM/"])(
    "%s は受け付ける",
    (url) => {
      expect(isStoryLinkUrl(url)).toBe(true);
    }
  );

  it.each([
    "javascript:alert(1)",
    "mailto:a@example.com",
    "ftp://example.com",
    "https:/my/settings",
    "https:evil.com",
    "example.com",
    "/my/settings",
    "https://",
    "",
  ])("%s は断る", (url) => {
    expect(isStoryLinkUrl(url)).toBe(false);
  });
});
