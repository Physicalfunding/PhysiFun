import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { PROJECT_STORY_LIMITS, ProjectStory } from "@physifun/domain";
import { describe, expect, it } from "vitest";
import {
  canEditStory,
  countStoryImages,
  countStoryVideos,
  isStoryLinkUrl,
  parseYouTubeVideoId,
  storyEditorExtensions,
} from "../storyEditorExtensions";

/**
 * Issue #317: ストーリーのエディタの拡張の組み合わせのテスト。
 *
 * エディタの画面（DOM）は要らず、拡張から組み立てたスキーマ（`getSchema`）で、出せる要素・装飾・属性が
 * domain の `ProjectStory` の許可するものと一致することを確かめる。
 * `schema.nodeFromJSON(json).toJSON()` は、エディタの `getJSON()` と同じ形（既定の属性も含む）になる
 */
const schema = getSchema(storyEditorExtensions);
const IMAGE_URL = "https://abc.supabase.co/storage/v1/object/public/project-images/p/story/a.jpg";
const create = (value: unknown) =>
  ProjectStory.create(value, { isAllowedImageUrl: (url) => url === IMAGE_URL });

const text = (value: string, marks?: unknown[]) => ({ type: "text", text: value, marks });
const li = (value: string) => ({
  type: "listItem",
  content: [{ type: "paragraph", content: [text(value)] }],
});

describe("storyEditorExtensions", () => {
  it("出せる要素は domain が許可するものだけ", () => {
    expect(Object.keys(schema.nodes).sort()).toEqual([
      "bulletList",
      "doc",
      "hardBreak",
      "heading",
      "image",
      "listItem",
      "orderedList",
      "paragraph",
      "text",
      "youtube",
    ]);
  });

  it("YouTube は文書の直下とリストの項目に置けるブロックで、中に文字を持たず、属性は videoId だけ（#321）", () => {
    const youtube = schema.nodes.youtube;
    expect(youtube.isBlock).toBe(true);
    expect(youtube.isAtom).toBe(true);
    expect(Object.keys(youtube.spec.attrs ?? {})).toEqual(["videoId"]);
    expect(schema.nodes.doc.contentMatch.matchType(youtube)).not.toBeNull();
    expect(
      schema.nodes.listItem.contentMatch.matchType(schema.nodes.paragraph)?.matchType(youtube)
    ).not.toBeNull();
    expect(schema.nodes.paragraph.contentMatch.matchType(youtube)).toBeNull();
  });

  it("貼り付けた <iframe> は src が YouTube の URL のものだけ読み、ほかの iframe は捨てる（#321）", () => {
    const rules = schema.nodes.youtube.spec.parseDOM ?? [];
    const parse = (tag: string, attrs: Record<string, string | null>) => {
      const rule = rules.find((r) => "tag" in r && r.tag?.startsWith(tag));
      return rule && "getAttrs" in rule && typeof rule.getAttrs === "function"
        ? rule.getAttrs({
            getAttribute: (name: string) => attrs[name] ?? null,
          } as unknown as HTMLElement)
        : undefined;
    };
    expect(parse("iframe", { src: "https://www.youtube.com/embed/dQw4w9WgXcQ?si=abc" })).toEqual({
      videoId: "dQw4w9WgXcQ",
    });
    expect(parse("iframe", { src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" })).toEqual({
      videoId: "dQw4w9WgXcQ",
    });
    expect(parse("iframe", { src: "https://evil.example.com/embed/dQw4w9WgXcQ" })).toBe(false);
    expect(parse("iframe", { src: "javascript:alert(1)" })).toBe(false);
    // 自分の描画（div[data-youtube-video-id]）も読む。形に合わない ID は捨てる
    expect(parse("div", { "data-youtube-video-id": "dQw4w9WgXcQ" })).toEqual({
      videoId: "dQw4w9WgXcQ",
    });
    expect(parse("div", { "data-youtube-video-id": "dQw4w9WgXcQ!" })).toBe(false);
  });

  it("エディタの中では youtube-nocookie の iframe を描き、ID が無ければ iframe を出さない（#321）", () => {
    const render = (attrs: Record<string, unknown>) =>
      schema.nodes.youtube.spec.toDOM?.(schema.nodes.youtube.create(attrs));
    expect(render({ videoId: "dQw4w9WgXcQ" })).toEqual([
      "div",
      { "data-youtube-video-id": "dQw4w9WgXcQ", class: "story-youtube" },
      [
        "iframe",
        expect.objectContaining({ src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" }),
      ],
    ]);
    expect(render({})).toEqual(["div", { class: "story-youtube" }]);
  });

  it("YouTube を含むエディタの JSON が ProjectStory の検査を通る（#321）", () => {
    const json = schema
      .nodeFromJSON({
        type: "doc",
        content: [
          { type: "youtube", attrs: { videoId: "dQw4w9WgXcQ" } },
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [{ type: "youtube", attrs: { videoId: "a-b_c-d_e-f" } }],
              },
            ],
          },
        ],
      })
      .toJSON();
    const result = create(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.toJSON().content).toEqual([
      { type: "youtube", attrs: { videoId: "dQw4w9WgXcQ" } },
      {
        type: "bulletList",
        content: [
          { type: "listItem", content: [{ type: "youtube", attrs: { videoId: "a-b_c-d_e-f" } }] },
        ],
      },
    ]);
  });

  it("画像は文書の直下とリストの項目に置けるブロックで、中に文字を持たず、属性は src と alt だけ", () => {
    const image = schema.nodes.image;
    expect(image.isBlock).toBe(true);
    expect(image.isAtom).toBe(true);
    expect(Object.keys(image.spec.attrs ?? {})).toEqual(["src", "alt"]);
    expect(schema.nodes.doc.contentMatch.matchType(image)).not.toBeNull();
    // リストの項目は「段落のあとにブロック」なので、段落の次に置ける
    expect(
      schema.nodes.listItem.contentMatch.matchType(schema.nodes.paragraph)?.matchType(image)
    ).not.toBeNull();
    expect(schema.nodes.paragraph.contentMatch.matchType(image)).toBeNull();
  });

  it("貼り付けた <img> は許可リスト（自サイトの Storage）の URL のものだけ読み、他サイトや data: は捨てる", () => {
    const rule = schema.nodes.image.spec.parseDOM?.[0];
    const parse = (attrs: Record<string, string | null>) =>
      rule && "getAttrs" in rule && typeof rule.getAttrs === "function"
        ? rule.getAttrs({
            getAttribute: (name: string) => attrs[name] ?? null,
          } as unknown as HTMLElement)
        : undefined;
    expect(parse({ src: IMAGE_URL, alt: "活動の様子" })).toEqual({
      src: IMAGE_URL,
      alt: "活動の様子",
    });
    expect(parse({ src: IMAGE_URL })).toEqual({ src: IMAGE_URL, alt: null });
    expect(parse({ src: "https://example.com/a.png" })).toBe(false);
    expect(parse({ src: "data:image/png;base64,AAAA" })).toBe(false);
    expect(parse({ src: "http://example.com/a.png" })).toBe(false);
    expect(parse({ src: "javascript:alert(1)" })).toBe(false);
    expect(parse({ src: "" })).toBe(false);
  });

  it("画像を含むエディタの JSON が ProjectStory の検査を通り、alt が無い（null）ときは省かれる", () => {
    const json = schema
      .nodeFromJSON({
        type: "doc",
        content: [
          { type: "image", attrs: { src: IMAGE_URL, alt: "活動の様子" } },
          { type: "image", attrs: { src: IMAGE_URL } },
          {
            type: "bulletList",
            content: [
              { type: "listItem", content: [{ type: "image", attrs: { src: IMAGE_URL } }] },
            ],
          },
        ],
      })
      .toJSON();
    expect(json.content[1].attrs).toEqual({ src: IMAGE_URL, alt: null });

    const result = create(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.toJSON().content).toEqual([
      { type: "image", attrs: { src: IMAGE_URL, alt: "活動の様子" } },
      { type: "image", attrs: { src: IMAGE_URL } },
      {
        type: "bulletList",
        content: [{ type: "listItem", content: [{ type: "image", attrs: { src: IMAGE_URL } }] }],
      },
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

  it("画像を含む本文は編集できる（#320）", () => {
    expect(
      canEditStory({
        type: "doc",
        content: [{ type: "image", attrs: { src: "https://abc.supabase.co/a.png" } }],
      })
    ).toBe(true);
  });

  it("YouTube を含む本文は編集できる（#321）", () => {
    expect(
      canEditStory({
        type: "doc",
        content: [{ type: "youtube", attrs: { videoId: "dQw4w9WgXcQ" } }],
      })
    ).toBe(true);
  });

  it("このエディタに無い要素を含む本文は編集できない（空で開いて消さないため）", () => {
    expect(canEditStory({ type: "doc", content: [{ type: "video", attrs: { src: "a" } }] })).toBe(
      false
    );
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

describe("countStoryImages", () => {
  const image = { type: "image", attrs: { src: IMAGE_URL } };
  const doc = (content: unknown[]) => schema.nodeFromJSON({ type: "doc", content });

  it("文書の直下とリストの項目の中の画像を数える", () => {
    expect(countStoryImages(doc([{ type: "paragraph" }]))).toBe(0);
    expect(
      countStoryImages(
        doc([
          image,
          { type: "paragraph", content: [text("a")] },
          { type: "bulletList", content: [{ type: "listItem", content: [image, image] }] },
        ])
      )
    ).toBe(3);
  });

  it("上限と比べられる（PROJECT_STORY_LIMITS.images 枚でちょうど上限）", () => {
    const full = doc(Array.from({ length: PROJECT_STORY_LIMITS.images }, () => image));
    expect(countStoryImages(full)).toBe(PROJECT_STORY_LIMITS.images);
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

describe("countStoryVideos", () => {
  const youtube = { type: "youtube", attrs: { videoId: "dQw4w9WgXcQ" } };
  const doc = (content: unknown[]) => schema.nodeFromJSON({ type: "doc", content });

  it("文書の直下とリストの項目の中の動画を数える（画像は数えない）", () => {
    expect(countStoryVideos(doc([{ type: "paragraph" }]))).toBe(0);
    expect(
      countStoryVideos(
        doc([
          youtube,
          { type: "image", attrs: { src: IMAGE_URL } },
          { type: "bulletList", content: [{ type: "listItem", content: [youtube] }] },
        ])
      )
    ).toBe(2);
  });

  it("上限は domain の PROJECT_STORY_LIMITS.videos（5 本）", () => {
    expect(PROJECT_STORY_LIMITS.videos).toBe(5);
  });
});

describe("parseYouTubeVideoId", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
    ["https://youtube.com/watch?v=dQw4w9WgXcQ&t=10s"],
    ["https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ"],
    ["https://music.youtube.com/watch?v=dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?si=abc"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ?start=10"],
    ["https://www.youtube.com/live/dQw4w9WgXcQ"],
    ["https://www.youtube.com/v/dQw4w9WgXcQ"],
    ["https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["http://www.youtube.com/watch?v=dQw4w9WgXcQ"],
    ["  https://youtu.be/dQw4w9WgXcQ  "],
    ["HTTPS://WWW.YOUTUBE.COM/watch?v=dQw4w9WgXcQ"],
  ])("YouTube の URL %s から動画 ID を取り出す", (url) => {
    expect(parseYouTubeVideoId(url)).toBe("dQw4w9WgXcQ");
  });

  it.each([
    ["YouTube 以外のサイト", "https://vimeo.com/123456789"],
    ["YouTube に似せたホスト", "https://www.youtube.com.evil.example/watch?v=dQw4w9WgXcQ"],
    ["YouTube を含むだけのホスト", "https://notyoutube.com/watch?v=dQw4w9WgXcQ"],
    ["チャンネルのページ", "https://www.youtube.com/@channel"],
    ["動画の ID が無い", "https://www.youtube.com/watch"],
    ["動画の ID が短い", "https://www.youtube.com/watch?v=dQw4w9WgXc"],
    ["動画の ID に記号", "https://youtu.be/dQw4w9WgXc!"],
    ["動画 ID だけ", "dQw4w9WgXcQ"],
    ["https / http 以外", "javascript:alert(1)"],
    ["空", ""],
  ])("%s（%s）は断る", (_, url) => {
    expect(parseYouTubeVideoId(url)).toBeNull();
  });
});
