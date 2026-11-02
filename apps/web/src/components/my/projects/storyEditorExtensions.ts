import {
  Extension,
  type Extensions,
  type JSONContent,
  Node,
  getSchema,
  mergeAttributes,
} from "@tiptap/core";
import Link from "@tiptap/extension-link";
import { OrderedList } from "@tiptap/extension-list";
import TextAlign from "@tiptap/extension-text-align";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";
import { PROJECT_STORY_TEMPLATE_HEADINGS, isYouTubeVideoId } from "@physifun/domain";
import { isAllowedImageUrl } from "@physifun/ui-shared";

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
 * 画像（#320、設計書 §5.3・§5.7）。文書の直下かリストの項目の中に置くブロックで、中に文字は持たない（atom）。
 *
 * - 属性は domain の `ProjectStory` が許す `src`・`alt` だけ。Tiptap の公式の Image 拡張は `title`・`width`・`height` も
 *   文書データに入れるので使わず、自前の小さなノードにする
 * - 画像はツールバーの画像ボタンから入れる（ブラウザで縮小 → アップロード API（#319）が返す URL を `src` にする）
 * - 貼り付けた HTML の `<img>` は、表示部品と同じ許可リスト（`isAllowedImageUrl`。自サイトの Storage のホストだけ）に
 *   合う URL のものだけ読み、他サイトの画像や `data:` は捨てる（リンクの `isAllowedUri` と同じ考え方）。
 *   「そのプロジェクトのフォルダ配下か」はサーバーだけが知っているので、保存するときの検査（#319）に任せる
 * - エディタの中では `<img>` で描く。見た目は `StoryEditor` の CSS が付ける
 */
const StoryImage = Node.create({
  name: "image",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
    };
  },
  parseHTML() {
    return [
      {
        tag: "img[src]",
        getAttrs: (element) => {
          const src = element.getAttribute("src");
          if (!src || !isAllowedImageUrl(src)) return false;
          return { src, alt: element.getAttribute("alt") };
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes, { loading: "lazy" })];
  },
});

/**
 * YouTube の動画の URL から動画 ID を取り出す（#321、設計書 §5.2）。YouTube の URL でなければ null。
 *
 * 受け付ける形（`www.`・`m.`・`music.` はあってもなくてもよい）:
 * - `youtube.com/watch?v={ID}`
 * - `youtu.be/{ID}`
 * - `youtube.com/shorts/{ID}`・`/embed/{ID}`・`/live/{ID}`・`/v/{ID}`
 * - `youtube-nocookie.com/embed/{ID}`
 *
 * 取り出した ID は domain と同じ基準（`isYouTubeVideoId`）で確かめる
 */
export function parseYouTubeVideoId(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
  let candidate: string | null = null;
  if (host === "youtu.be") {
    candidate = url.pathname.split("/")[1] ?? null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") {
      candidate = url.searchParams.get("v");
    } else {
      const prefix = YOUTUBE_PATH_PREFIXES.find((p) => url.pathname.startsWith(p));
      if (prefix) candidate = url.pathname.slice(prefix.length).split("/")[0] ?? null;
    }
  }
  // プレイリストの埋め込み URL（`/embed/videoseries?list=...`）は、`videoseries` がちょうど 11 文字で ID の形に合ってしまう。
  // 動画ではないので断る（保存すると再生できない枠になる）
  if (candidate === "videoseries") return null;
  return isYouTubeVideoId(candidate) ? candidate : null;
}

const YOUTUBE_PATH_PREFIXES = ["/shorts/", "/embed/", "/live/", "/v/"];

/**
 * エディタの中で YouTube の枠に付けるクラス。見た目は `StoryEditor` の CSS が付ける
 * （CSS 側は Tailwind の走査のためクラス名をそのまま書いているので、この値を変えるときは一緒に直す）
 */
export const STORY_YOUTUBE_CLASS = "story-youtube";

/**
 * YouTube（#321、設計書 §5.2）。画像と同じく文書の直下かリストの項目の中に置くブロック（atom）。
 *
 * - 属性は domain の `ProjectStory` が許す `videoId` だけ。Tiptap の公式の Youtube 拡張は `src`（URL）・`width`・`height`・
 *   `start` を文書データに入れるので使わず、自前の小さなノードにする
 * - 動画はツールバーの動画ボタンから、YouTube の URL を入れて足す（`parseYouTubeVideoId` で ID を取り出す）
 * - HTML（text/html の貼り付けや `setContent`）で来た要素は、自分の描画（`div[data-youtube-video-id]`）と、src が YouTube の URL の
 *   `<iframe>` だけを読む。ほかの iframe は捨てる（リンク・画像と同じ守り）。YouTube の「共有 > 埋め込む」の欄からコピーした
 *   `<iframe ...>` は text/plain なので文字として入る（動画にはならない。動画は動画ボタンから入れる）
 * - エディタの中では表示部品と同じ youtube-nocookie の iframe を描く（クリックは効かないようにして、枠をクリックすると
 *   ノードが選ばれ、Backspace で消せる。再生は「プレビュー」で確かめる）。見た目は `StoryEditor` の CSS が付ける。
 *   本物のプレイヤーを最大 5 本読み込む負荷は承知のうえ（サムネイル画像を出すには CSP の `img-src` を広げる必要がある）
 */
const StoryYoutube = Node.create({
  name: "youtube",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      // 自分で `data-youtube-video-id` として描くので、Tiptap の既定の属性の描画（`videoid="..."`）は止める
      videoId: { default: null, rendered: false },
    };
  },
  parseHTML() {
    return [
      {
        tag: "div[data-youtube-video-id]",
        getAttrs: (element) => {
          const videoId = element.getAttribute("data-youtube-video-id");
          return isYouTubeVideoId(videoId) ? { videoId } : false;
        },
      },
      {
        tag: "iframe[src]",
        getAttrs: (element) => {
          const videoId = parseYouTubeVideoId(element.getAttribute("src") ?? "");
          return videoId ? { videoId } : false;
        },
      },
    ];
  },
  renderHTML({ node }) {
    const videoId: unknown = node.attrs.videoId;
    // 形に合わない ID（属性なしで作られたノードなど）は iframe を出さない
    if (!isYouTubeVideoId(videoId)) return ["div", { class: STORY_YOUTUBE_CLASS }];
    return [
      "div",
      { "data-youtube-video-id": videoId, class: STORY_YOUTUBE_CLASS },
      [
        "iframe",
        {
          src: `https://www.youtube-nocookie.com/embed/${videoId}`,
          title: "YouTube の動画",
          loading: "lazy",
          // エディタの中では操作しない（クリックで枠を選べるように）。タブ移動の対象からも外す
          tabindex: "-1",
        },
      ],
    ];
  },
});

/**
 * 本文に入っている画像の枚数。上限（`PROJECT_STORY_LIMITS.images`）に達したら画像ボタンを使えなくするために数える
 */
export function countStoryImages(doc: ProseMirrorNode): number {
  return countNodes(doc, StoryImage.name);
}

/**
 * 本文に入っている動画の本数。上限（`PROJECT_STORY_LIMITS.videos`）に達したら動画ボタンを使えなくするために数える
 */
export function countStoryVideos(doc: ProseMirrorNode): number {
  return countNodes(doc, StoryYoutube.name);
}

function countNodes(doc: ProseMirrorNode, name: string): number {
  let count = 0;
  doc.descendants((node) => {
    if (node.type.name === name) count += 1;
  });
  return count;
}

/**
 * 見出しの型（`PROJECT_STORY_TEMPLATE_HEADINGS`）の下に出す書き方のヒント（#318、設計書 §5.4）。
 * 薄い字で出すだけで、保存する文書データには入れない
 */
export const STORY_TEMPLATE_HINTS: Readonly<
  Record<(typeof PROJECT_STORY_TEMPLATE_HEADINGS)[number], string>
> = {
  このプロジェクトで実現したいこと: "どんな活動をして、何を実現したいのかを具体的に書きましょう。",
  立ち上げの背景: "始めようと思ったきっかけや、感じている課題を書きましょう。",
  一緒にやってほしいこと: "手伝ってほしいことや、来てほしい人を書きましょう。",
  活動の様子: "これまでの活動や現場の様子を、写真や動画で伝えましょう。",
};

/** ヒントの文の長さの上限。スマホ幅でも 2 行に収まるようにする（`StoryEditor` の CSS が段落の高さを 2 行分にしている） */
export const STORY_HINT_MAX_LENGTH = 32;

/**
 * ヒントを出す段落に付けるクラスと属性。見た目は `StoryEditor` の CSS が付ける
 * （CSS 側は Tailwind の走査のためクラス名をそのまま書いているので、この値を変えるときは一緒に直す）
 */
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
 *   箇条書き・番号付きリスト・項目・画像（`StoryImage`）・YouTube（`StoryYoutube`）
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
  StoryImage,
  StoryYoutube,
  StoryTemplateHints,
];

const storyEditorSchema = getSchema(storyEditorExtensions);

/**
 * 読み込んだ本文を、このエディタで編集できるか（要素・装飾がすべてこのエディタのスキーマにあり、置ける場所にあるか）。
 *
 * いまは domain の `ProjectStory` が許す要素をすべてこのエディタが持つが、Tiptap は読めない本文を黙って空にして開くので、
 * そのまま保存すると本文が消える。domain に要素を足してエディタが追いつく前の本文や、型どおりでない本文が来ても
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
