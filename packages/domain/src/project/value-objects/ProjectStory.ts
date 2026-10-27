import { type Result, err, ok } from "../../shared/result";
import type { ProjectStoryError, StoryNotAllowedReason } from "../errors/ProjectError";

/**
 * ストーリーの上限（設計書 §5.3）
 */
const LIMITS = {
  /** 画面に表示される文字の数。文字ノードの文字だけを数える（装飾・画像の情報は数えない） */
  textLength: 10000,
  images: 20,
  videos: 5,
  /** 文書データ全体の大きさ（JSON にしたときの UTF-8 のバイト数）。想定外に大きいデータを防ぐ */
  bytes: 200 * 1024,
  /** 要素の入れ子の深さ。検査は再帰で辿るので、極端に深いデータは先に断る */
  depth: 20,
} as const;

export type StoryTextAlign = "left" | "center" | "right";

export type StoryMark =
  | { readonly type: "bold" }
  | { readonly type: "italic" }
  | { readonly type: "strike" }
  | { readonly type: "link"; readonly attrs: { readonly href: string } };

export type StoryInline =
  | { readonly type: "text"; readonly text: string; readonly marks?: readonly StoryMark[] }
  | { readonly type: "hardBreak"; readonly marks?: readonly StoryMark[] };

export type StoryBlock =
  | {
      readonly type: "paragraph";
      readonly attrs?: { readonly textAlign?: StoryTextAlign };
      readonly content?: readonly StoryInline[];
    }
  | {
      readonly type: "heading";
      readonly attrs: { readonly level: 2 | 3; readonly textAlign?: StoryTextAlign };
      readonly content?: readonly StoryInline[];
    }
  | { readonly type: "bulletList"; readonly content?: readonly StoryListItem[] }
  | {
      readonly type: "orderedList";
      readonly attrs?: { readonly start?: number };
      readonly content?: readonly StoryListItem[];
    }
  | { readonly type: "image"; readonly attrs: { readonly src: string; readonly alt?: string } }
  | { readonly type: "youtube"; readonly attrs: { readonly videoId: string } };

export interface StoryListItem {
  readonly type: "listItem";
  readonly content?: readonly StoryBlock[];
}

/**
 * ストーリーの文書データ。エディタ（Tiptap / ProseMirror）の JSON と同じ形
 */
export interface ProjectStoryDocument {
  readonly type: "doc";
  readonly content?: readonly StoryBlock[];
}

interface WalkContext {
  readonly isAllowedImageUrl: (url: string) => boolean;
  textLength: number;
  images: number;
  videos: number;
}

/**
 * 属性の決まり。`test` が false を返したら `reason` で断る
 */
interface AttrRule {
  readonly required: boolean;
  readonly reason: StoryNotAllowedReason;
  readonly test: (value: unknown, ctx: WalkContext) => boolean;
}

const required = (reason: StoryNotAllowedReason, test: AttrRule["test"]): AttrRule => ({
  required: true,
  reason,
  test,
});
const optional = (test: AttrRule["test"]): AttrRule => ({
  required: false,
  reason: "INVALID_ATTRIBUTE_VALUE",
  test,
});

const BLOCKS = ["paragraph", "heading", "bulletList", "orderedList", "image", "youtube"];
/** 装飾（marks）を付けられるのは、この 2 つだけ */
const INLINES = ["text", "hardBreak"];

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

const textAlign = optional((v) => v === "left" || v === "center" || v === "right");

/**
 * 許可する要素と、その子（null は子を持たない）・属性（設計書 §6.1）。ここに無いものはすべて断る
 */
const NODE_RULES: Readonly<
  Record<string, { children: readonly string[] | null; attrs: Record<string, AttrRule> }>
> = {
  doc: { children: BLOCKS, attrs: {} },
  paragraph: { children: INLINES, attrs: { textAlign } },
  heading: {
    children: INLINES,
    attrs: { level: required("INVALID_ATTRIBUTE_VALUE", (v) => v === 2 || v === 3), textAlign },
  },
  bulletList: { children: ["listItem"], attrs: {} },
  orderedList: {
    children: ["listItem"],
    attrs: { start: optional((v) => Number.isSafeInteger(v) && (v as number) >= 0) },
  },
  // エディタ（Tiptap）の listItem と同じく、項目の中にはブロックを置ける（入れ子のリストなど）
  listItem: { children: BLOCKS, attrs: {} },
  text: { children: null, attrs: {} },
  hardBreak: { children: null, attrs: {} },
  image: {
    children: null,
    attrs: {
      src: required(
        "INVALID_IMAGE_SRC",
        (v, ctx) => typeof v === "string" && ctx.isAllowedImageUrl(v)
      ),
      alt: optional((v) => typeof v === "string"),
    },
  },
  // 動画 ID だけを持つ。埋め込みの URL は表示するときに組み立てる（設計書 §5.2）
  youtube: {
    children: null,
    attrs: {
      videoId: required(
        "INVALID_YOUTUBE_ID",
        (v) => typeof v === "string" && YOUTUBE_VIDEO_ID.test(v)
      ),
    },
  },
};

const MARK_RULES: Readonly<Record<string, Record<string, AttrRule>>> = {
  bold: {},
  italic: {},
  strike: {},
  link: { href: required("INVALID_LINK_HREF", (v) => isHttpUrl(v)) },
};

const NODE_KEYS = ["type", "attrs", "content", "marks", "text"];
const MARK_KEYS = ["type", "attrs"];

/**
 * ProjectStory 値オブジェクト
 *
 * プロジェクトの本文（ストーリー）の文書データ。エディタの JSON を、許可した要素・装飾・属性だけで
 * できているか検査してから持つ。許可外のものは黙って捨てず、エラーで断る（設計書 §6.1）。
 *
 * - 画像の URL の判定は外から受け取る（判定が環境変数で変わるため、domain には持ち込まない）
 * - 検査を通った文書は作り直し、凍結して持つ（検査したものと持つものを必ず一致させ、後から書き換えられないため）。
 *   値が null の属性と、空の marks は「指定なし」として省く
 * - `URL`・`TextEncoder` は外部ライブラリではなく、どの実行環境にもある標準の API（型は `ProjectId` の
 *   `node:crypto` と同じく `@types/node` から来る）
 */
export class ProjectStory {
  private constructor(private readonly document: ProjectStoryDocument) {}

  static create(
    value: unknown,
    options: { readonly isAllowedImageUrl: (url: string) => boolean }
  ): Result<ProjectStory, ProjectStoryError> {
    const ctx: WalkContext = {
      isAllowedImageUrl: options.isAllowedImageUrl,
      textLength: 0,
      images: 0,
      videos: 0,
    };
    const normalized = normalizeNode(value, ["doc"], "$", 1, ctx);
    if (!normalized.ok) return normalized;

    if (ctx.textLength > LIMITS.textLength) {
      return err({
        type: "STORY_TOO_LONG",
        maxLength: LIMITS.textLength,
        actualLength: ctx.textLength,
      });
    }
    if (ctx.images > LIMITS.images) {
      return err({
        type: "STORY_TOO_MANY_IMAGES",
        maxCount: LIMITS.images,
        actualCount: ctx.images,
      });
    }
    if (ctx.videos > LIMITS.videos) {
      return err({
        type: "STORY_TOO_MANY_VIDEOS",
        maxCount: LIMITS.videos,
        actualCount: ctx.videos,
      });
    }
    const bytes = new TextEncoder().encode(JSON.stringify(normalized.value)).length;
    if (bytes > LIMITS.bytes) {
      return err({ type: "STORY_TOO_LARGE", maxBytes: LIMITS.bytes, actualBytes: bytes });
    }

    // normalizeNode が NODE_RULES どおりの形だけを組み立てるので、文書データの型として扱える
    return ok(new ProjectStory(normalized.value as unknown as ProjectStoryDocument));
  }

  /**
   * 文字だけの本文から作る（設計書 §7）。1 行を 1 段落にし、空の行は段落の区切りとして捨てる
   */
  static fromPlainText(text: string): Result<ProjectStory, ProjectStoryError> {
    const content = text
      .split(/\r\n|\r|\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => ({ type: "paragraph", content: [{ type: "text", text: line }] }));
    // 文字だけの本文に画像は無いので、画像の判定はすべて断るものを渡す
    return ProjectStory.create({ type: "doc", content }, { isAllowedImageUrl: () => false });
  }

  /**
   * 公開申請のときの「入力済み」の判定（設計書 §5.5）。
   * 見出し以外に空白でない文字があるか、画像か動画が 1 つ以上あれば入力済み。見出しの型だけなら未入力
   */
  isFilled(): boolean {
    return hasContent(this.document.content ?? []);
  }

  toJSON(): ProjectStoryDocument {
    return this.document;
  }
}

function hasContent(blocks: readonly StoryBlock[]): boolean {
  return blocks.some((block) => {
    switch (block.type) {
      case "image":
      case "youtube":
        return true;
      case "heading":
        return false;
      case "paragraph":
        return (block.content ?? []).some((i) => i.type === "text" && i.text.trim().length > 0);
      case "bulletList":
      case "orderedList":
        return (block.content ?? []).some((item) => hasContent(item.content ?? []));
    }
  });
}

type Json = Record<string, unknown>;

function normalizeNode(
  value: unknown,
  allowed: readonly string[],
  path: string,
  depth: number,
  ctx: WalkContext
): Result<Json, ProjectStoryError> {
  if (depth > LIMITS.depth) return notAllowed("TOO_DEEP", path);
  if (!isPlainObject(value) || Object.keys(value).some((k) => !NODE_KEYS.includes(k))) {
    return notAllowed("INVALID_STRUCTURE", path);
  }
  // 値は最初に 1 回だけ読む（検査した値と持つ値を必ず一致させるため）
  const { type, attrs: rawAttrs, marks: rawMarks, text, content: rawContent } = value;
  if (typeof type !== "string" || !Object.hasOwn(NODE_RULES, type)) {
    return notAllowed("UNSUPPORTED_NODE", path);
  }
  // 許可した要素でも、置けない場所にあれば断る（例: 段落の中の画像、リストの直下の段落）
  if (!allowed.includes(type)) return notAllowed("INVALID_STRUCTURE", path);
  const rule = NODE_RULES[type] as (typeof NODE_RULES)[string];
  const node: Json = { type };

  const attrs = normalizeAttrs(rawAttrs, rule.attrs, `${path}.attrs`, ctx);
  if (!attrs.ok) return attrs;
  if (attrs.value) node.attrs = attrs.value;

  if (rawMarks !== undefined) {
    if (!INLINES.includes(type) || !Array.isArray(rawMarks)) {
      return notAllowed("INVALID_STRUCTURE", path);
    }
    const marks: Json[] = [];
    for (const [i, raw] of rawMarks.entries()) {
      const mark = normalizeMark(raw, `${path}.marks[${i}]`, ctx);
      if (!mark.ok) return mark;
      marks.push(mark.value);
    }
    if (marks.length > 0) node.marks = Object.freeze(marks);
  }

  if (type === "text") {
    if (typeof text !== "string" || text.length === 0) return notAllowed("INVALID_STRUCTURE", path);
    node.text = text;
    ctx.textLength += text.length;
  } else if (text !== undefined) {
    return notAllowed("INVALID_STRUCTURE", path);
  }

  if (rawContent !== undefined) {
    if (rule.children === null || !Array.isArray(rawContent)) {
      return notAllowed("INVALID_STRUCTURE", path);
    }
    const content: Json[] = [];
    for (const [i, raw] of rawContent.entries()) {
      const child = normalizeNode(raw, rule.children, `${path}.content[${i}]`, depth + 1, ctx);
      if (!child.ok) return child;
      content.push(child.value);
    }
    node.content = Object.freeze(content);
  }

  if (type === "image") ctx.images += 1;
  if (type === "youtube") ctx.videos += 1;
  return ok(Object.freeze(node));
}

function normalizeMark(
  value: unknown,
  path: string,
  ctx: WalkContext
): Result<Json, ProjectStoryError> {
  if (!isPlainObject(value) || Object.keys(value).some((k) => !MARK_KEYS.includes(k))) {
    return notAllowed("INVALID_STRUCTURE", path);
  }
  const { type } = value;
  if (typeof type !== "string" || !Object.hasOwn(MARK_RULES, type)) {
    return notAllowed("UNSUPPORTED_MARK", path);
  }
  const { attrs: rawAttrs } = value;
  const attrs = normalizeAttrs(
    rawAttrs,
    MARK_RULES[type] as Record<string, AttrRule>,
    `${path}.attrs`,
    ctx
  );
  if (!attrs.ok) return attrs;
  return ok(Object.freeze(attrs.value ? { type, attrs: attrs.value } : { type }));
}

/**
 * 属性を検査して作り直す。属性が 1 つも残らなければ null を返す
 */
function normalizeAttrs(
  value: unknown,
  rules: Readonly<Record<string, AttrRule>>,
  path: string,
  ctx: WalkContext
): Result<Json | null, ProjectStoryError> {
  if (value !== undefined && !isPlainObject(value)) return notAllowed("INVALID_STRUCTURE", path);
  const raw = value ?? {};
  for (const key of Object.keys(raw)) {
    if (!Object.hasOwn(rules, key)) return notAllowed("UNSUPPORTED_ATTRIBUTE", `${path}.${key}`);
  }
  const attrs: Json = {};
  for (const [key, rule] of Object.entries(rules)) {
    const v = raw[key];
    if ((v === undefined || v === null) && !rule.required) continue;
    if (!rule.test(v, ctx)) return notAllowed(rule.reason, `${path}.${key}`);
    attrs[key] = v;
  }
  return ok(Object.keys(attrs).length > 0 ? Object.freeze(attrs) : null);
}

function isPlainObject(value: unknown): value is Json {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * リンク先は http / https だけ。ブラウザと同じ規則（WHATWG URL）で読むので、
 * `JAVASCRIPT:` や前後の空白・途中のタブで見た目をごまかしたものも同じように判定できる
 */
function isHttpUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function notAllowed(reason: StoryNotAllowedReason, path: string): Result<never, ProjectStoryError> {
  return err({ type: "STORY_NOT_ALLOWED", reason, path });
}

export const PROJECT_STORY_LIMITS = LIMITS;
