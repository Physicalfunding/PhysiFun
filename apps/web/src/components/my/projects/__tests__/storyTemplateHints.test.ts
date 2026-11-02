import { getSchema } from "@tiptap/core";
import { PROJECT_STORY_TEMPLATE_HEADINGS, ProjectStory } from "@physifun/domain";
import { describe, expect, it } from "vitest";
import {
  STORY_HINT_ATTRIBUTE,
  STORY_HINT_CLASS,
  STORY_HINT_MAX_LENGTH,
  STORY_TEMPLATE_HINTS,
  collectStoryHints,
  storyEditorExtensions,
} from "../storyEditorExtensions";

/**
 * Issue #318: 見出しの型の下のヒント。
 *
 * エディタの画面（DOM）は要らず、拡張から組み立てたスキーマで文書データ（ProseMirror の Node）を作り、
 * どの段落にどのヒントが付くかを確かめる。ヒントは decoration なので、文書データそのものは変わらない
 */
const schema = getSchema(storyEditorExtensions);
const nodeOf = (json: unknown) => schema.nodeFromJSON(json);
const h2 = (text: string) => ({
  type: "heading",
  attrs: { level: 2 },
  content: [{ type: "text", text }],
});
const p = (text?: string) =>
  text === undefined
    ? { type: "paragraph" }
    : { type: "paragraph", content: [{ type: "text", text }] };

function template() {
  const r = ProjectStory.fromTemplate();
  if (!r.ok) throw new Error("fixture broken");
  return r.value.toJSON();
}

describe("collectStoryHints", () => {
  it("見出しの型のすべてにヒントがあり、スマホでも 2 行に収まる長さ", () => {
    expect(Object.keys(STORY_TEMPLATE_HINTS).sort()).toEqual(
      [...PROJECT_STORY_TEMPLATE_HEADINGS].sort()
    );
    for (const hint of Object.values(STORY_TEMPLATE_HINTS)) {
      expect(hint.length).toBeLessThanOrEqual(STORY_HINT_MAX_LENGTH);
    }
  });

  it("decoration が付けるクラスと属性は、StoryEditor の CSS がそのまま書いている名前と同じ", () => {
    // Tailwind はソースを文字列として走査するので、CSS 側は変数で組めない。ここで名前のずれを止める
    expect(STORY_HINT_CLASS).toBe("story-hint");
    expect(STORY_HINT_ATTRIBUTE).toBe("data-hint");
  });

  it("見出しの型（domain の fromTemplate）を開くと、4 つの見出しの下の空の段落にそれぞれのヒントが付く", () => {
    const doc = nodeOf(template());
    const hints = collectStoryHints(doc);
    expect(hints.map((h) => h.hint)).toEqual(
      PROJECT_STORY_TEMPLATE_HEADINGS.map((heading) => STORY_TEMPLATE_HINTS[heading])
    );
    // 位置は空の段落のもの（見出しの直後）
    for (const { pos, nodeSize } of hints) {
      const node = doc.nodeAt(pos);
      expect(node?.type.name).toBe("paragraph");
      expect(node?.content.size).toBe(0);
      expect(node?.nodeSize).toBe(nodeSize);
    }
  });

  it("段落に文字を書くと、その見出しのヒントは消える（他の見出しのヒントは残る）", () => {
    const doc = nodeOf({
      type: "doc",
      content: [h2("このプロジェクトで実現したいこと"), p("書き始めた"), h2("立ち上げの背景"), p()],
    });
    expect(collectStoryHints(doc).map((h) => h.hint)).toEqual([
      STORY_TEMPLATE_HINTS["立ち上げの背景"],
    ]);
  });

  it("型にない見出し・見出しの文字を変えたもの・見出しの直下でない空の段落にはヒントを出さない", () => {
    const doc = nodeOf({
      type: "doc",
      content: [
        h2("自由な見出し"),
        p(),
        h2("活動の様子を書く"),
        p(),
        p(),
        h2("活動の様子"),
        p("文字"),
        p(),
      ],
    });
    expect(collectStoryHints(doc)).toEqual([]);
  });

  it("小見出し（h3）でも、型と同じ文字ならヒントを出す", () => {
    const doc = nodeOf({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "活動の様子" }] },
        p(),
      ],
    });
    expect(collectStoryHints(doc).map((h) => h.hint)).toEqual([STORY_TEMPLATE_HINTS["活動の様子"]]);
  });

  it("ヒントは文書データを変えない（エディタを通した見出しの型は、domain で検査すると元と同じ）", () => {
    const json = template();
    // エディタは既定の属性（textAlign: null）を足すが、domain が「指定なし」として省く
    const saved = ProjectStory.create(nodeOf(json).toJSON(), { isAllowedImageUrl: () => false });
    expect(saved.ok && saved.value.toJSON()).toEqual(json);
    expect(Object.keys(schema.nodes.paragraph.spec.attrs ?? {})).toEqual(["textAlign"]);
  });
});
