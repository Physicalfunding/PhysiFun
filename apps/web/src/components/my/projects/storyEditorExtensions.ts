import type { Extensions } from "@tiptap/core";
import Link from "@tiptap/extension-link";
import { OrderedList } from "@tiptap/extension-list";
import TextAlign from "@tiptap/extension-text-align";
import StarterKit from "@tiptap/starter-kit";

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
 * 番号付きリスト。Tiptap の既定では `start` のほかに `type`（番号の種類）を JSON に入れるので、`start` だけにする
 */
const StoryOrderedList = OrderedList.extend({
  addAttributes() {
    return {
      start: {
        default: 1,
        parseHTML: (element) =>
          element.hasAttribute("start") ? parseInt(element.getAttribute("start") || "", 10) : 1,
      },
    };
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
];
