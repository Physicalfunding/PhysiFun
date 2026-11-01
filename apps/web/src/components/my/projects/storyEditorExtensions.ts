import { Extension, type Extensions, type JSONContent, getSchema } from "@tiptap/core";
import Link from "@tiptap/extension-link";
import { OrderedList } from "@tiptap/extension-list";
import TextAlign from "@tiptap/extension-text-align";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";
import { PROJECT_STORY_TEMPLATE_HEADINGS } from "@physifun/domain";

/**
 * リンク先として受け付ける URL か（`http://` か `https://` で始まり、URL として読めるもの）。
 * domain の `ProjectStory` と表示部品 `ProjectStoryView` の判定と同じ基準。
 * `https:/my/settings` のような書き方は、ブラウザでは自サイトへの相対リンクになるので断る
 */
export function isStoryLinkUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * リンク。Tiptap の既定では `href` のほかに `target`・`rel`・`class`・`title` を文書データ（JSON）に入れるが、
 * domain の `ProjectStory` は知らない属性を 1 つでも含む文書を断るので、`href` だけにする。
 * エディタの中で `<a>` に付く `target`・`rel` は `HTMLAttributes`（描画のときだけ付く）で残り、
 * 表示部品（`ProjectStoryView`）も自分で付けるので、文書データに持つ必要はない
 */
const StoryLink = Link.extend({
  addAttributes() {
    return {
      href: {
        default: null,
        parseHTML: (element) => element.getAttribute("href"),
      },
    };
  },
}).configure({
  // リンクはツールバーのダイアログからだけ入れる（文字を打つだけ・貼り付けるだけで勝手にリンクにしない）
  autolink: false,
  linkOnPaste: false,
  openOnClick: false,
  // 貼り付けた HTML のリンクも、http(s) 以外は文字だけにする（`javascript:` など）
  isAllowedUri: (url) => isStoryLinkUrl(url),
});

/**
 * 番号付きリスト。Tiptap の既定では `start` のほかに `type`（番号の種類）を JSON に入れるので、`start` だけにする。
 * 貼り付けた `<ol start="abc">` や `start="-3"` は、domain が断る値（NaN・負数）になり画面からは直しようがないので、1 にする
 */
const StoryOrderedList = OrderedList.extend({
  addAttributes() {
    return {
      start: {
        default: 1,
        parseHTML: (element) => {
          const start = parseInt(element.getAttribute("start") ?? "", 10);
          return Number.isSafeInteger(start) && start >= 0 ? start : 1;
        },
      },
    };
  },
});

/**
 * 見出しの型（`PROJECT_STORY_TEMPLATE_HEADINGS`）の下に出す書き方のヒント（#318、設計書 §5.4）。
 * 薄い字で出すだけで、保存する文書データには入れない
 */
export const STORY_TEMPLATE_HINTS: Readonly<
  Record<(typeof PROJECT_STORY_TEMPLATE_HEADINGS)[number], string>
> = {
  このプロジェクトで実現したいこと: "どんな活動をして、何を実現したいのかを具体的に書きましょう。",
  立ち上げの背景: "なぜこのプロジェクトを始めようと思ったのか、きっかけや課題を書きましょう。",
  一緒にやってほしいこと:
    "サポーターにどんなことを手伝ってほしいか、どんな人に来てほしいかを書きましょう。",
  活動の様子: "これまでの活動や現場の様子を、写真や動画も使って伝えましょう。",
};

/** ヒントを出す段落に付けるクラスと属性。見た目は `StoryEditor` の CSS が付ける */
export const STORY_HINT_CLASS = "story-hint";
export const STORY_HINT_ATTRIBUTE = "data-hint";

export interface StoryHint {
  /** 段落の位置（文書の直下なので、文書の中の絶対位置） */
  readonly pos: number;
  readonly nodeSize: number;
  readonly hint: string;
}

/**
 * ヒントを出す場所を探す。文書の直下で「見出しの型の見出し → 空の段落」と並んでいるところの、空の段落にだけ出す。
 * 段落に 1 文字でも書けばヒントは消え、見出しの文字を変えた（型の見出しでなくなった）ときも出さない
 */
export function collectStoryHints(doc: ProseMirrorNode): readonly StoryHint[] {
  const hints: StoryHint[] = [];
  let previous: ProseMirrorNode | null = null;
  doc.forEach((node, pos) => {
    if (
      previous?.type.name === "heading" &&
      node.type.name === "paragraph" &&
      node.content.size === 0
    ) {
      const hint = hintFor(previous.textContent);
      if (hint) hints.push({ pos, nodeSize: node.nodeSize, hint });
    }
    previous = node;
  });
  return hints;
}

function hintFor(heading: string): string | undefined {
  return Object.hasOwn(STORY_TEMPLATE_HINTS, heading)
    ? STORY_TEMPLATE_HINTS[heading as keyof typeof STORY_TEMPLATE_HINTS]
    : undefined;
}

/**
 * ヒントを ProseMirror の decoration で出す拡張。decoration は画面にだけ付くもので、文書データ（`getJSON()`）には入らない。
 * 文書が変わるたびに文書全体から決め直す（見出しの文字を変えたときに、直下の段落のヒントも追って変わるように。
 * 文書は最大でも 200 KB なので、毎回見ても軽い）
 */
const StoryTemplateHints = Extension.create({
  name: "storyTemplateHints",
  addProseMirrorPlugins() {
    const { editor } = this;
    return [
      new Plugin({
        props: {
          decorations(state) {
            if (!editor.isEditable) return DecorationSet.empty;
            return DecorationSet.create(
              state.doc,
              collectStoryHints(state.doc).map(({ pos, nodeSize, hint }) =>
                Decoration.node(pos, pos + nodeSize, {
                  class: STORY_HINT_CLASS,
                  [STORY_HINT_ATTRIBUTE]: hint,
                })
              )
            );
          },
        },
      }),
    ];
  },
});

/**
 * ストーリーのエディタ（Tiptap）の拡張の組み合わせ（#317、設計書 §5.2）。
 *
 * domain の `ProjectStory` が許可する要素・装飾・属性だけを出すように絞る（許可外のものは保存時に断られる）。
 * ただし守りの本体は保存時の `ProjectStory` の検査で、ここは「使えないものをそもそも出さない」ための絞り込み。
 *
 * - 要素: 段落・見出し（h2 / h3。h1 はページのタイトルが使うので、貼り付けても段落になる）・文字・改行・
 *   箇条書き・番号付きリスト・項目。画像は S-8（#320）、YouTube は S-9（#321）で足す
 * - 装飾: 太字・斜体・取り消し線・リンク。下線・コード・引用・区切り線・文字色は入れない
 * - 配置: 段落と見出しに `left` / `center` / `right`。指定なし（null）は domain が省く
 * - 文書の最後に空の段落を足す拡張（trailingNode）は、保存する JSON に空の段落が残るので入れない
 * - 見出しの型の下のヒント（`StoryTemplateHints`）は decoration なので、スキーマも保存する JSON も変えない
 */
export const storyEditorExtensions: Extensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    // 上で属性を絞ったものを使う
    link: false,
    orderedList: false,
    // 許可していない要素・装飾
    blockquote: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
    underline: false,
    trailingNode: false,
  }),
  StoryLink,
  StoryOrderedList,
  TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right"] }),
  StoryTemplateHints,
];

const storyEditorSchema = getSchema(storyEditorExtensions);

/**
 * 読み込んだ本文を、このエディタで編集できるか（要素・装飾がすべてこのエディタのスキーマにあるか）。
 *
 * domain の `ProjectStory` が許す要素のうち、画像（S-8 / #320）と YouTube（S-9 / #321）はまだこのエディタに無い。
 * Tiptap は読めない本文を黙って空にして開くので、そのまま保存すると本文が消える。
 * そうならないように、読めない本文は編集できない状態で開く（`StoryEditor`）
 */
export function canEditStory(value: JSONContent | null): boolean {
  if (value === null) return true;
  try {
    storyEditorSchema.nodeFromJSON(value).check();
    return true;
  } catch {
    return false;
  }
}
