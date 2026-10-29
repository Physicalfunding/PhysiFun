import type { ReactNode } from "react";
import type {
  ProjectStoryDocument,
  StoryBlock,
  StoryInline,
  StoryListItem,
  StoryMark,
} from "@physifun/domain";
import { isAllowedImageUrl } from "./isAllowedImageUrl";

/**
 * プロジェクトの本文（ストーリー）の表示部品（#314、設計書 §5.6・§6）。
 * 公開ページ・マイページ・運営の審査画面の 3 か所で使う。
 *
 * XSS 対策として、HTML の文字列を作って流し込まず（`dangerouslySetInnerHTML` は使わない）、
 * 文書データから React の要素を組み立てる。保存時に `ProjectStory` が検査済みだが、
 * 表示する側でも許可したものだけを描く（二重の守り）:
 * - 知らない要素は描かない。知らない装飾は無視して文字だけ出す
 * - 属性は決まったものだけを読む。配置は決まったクラスに置き換え、`style` には流し込まない
 * - リンクは `http://` か `https://` で始まるものだけ。合わなければ文字だけ出す
 * - 画像は `isAllowedImageUrl` に合うものだけ
 *
 * 見た目は docs-repository `docs/mvp/202604_claude_design/project-page/decided/` の見本に合わせる。
 * 色（orange）は見本の仮の色。admin でも使うため、web にだけある physifun-red ではなく Tailwind の標準色にしている。
 * リンクの文字は、白地とのコントラストが WCAG AA（4.5:1）に届くよう orange-700 にする。
 * 連続した空白・行頭の空白は詰めずに残す（whitespace-pre-wrap。エディタでの見え方と、文字だけの本文の頃の表示に合わせる）
 */
export function ProjectStoryView({ story }: { story: ProjectStoryDocument }) {
  return (
    <div className="whitespace-pre-wrap break-words text-sm leading-[1.7] text-gray-800 md:text-[15px] md:leading-[1.9]">
      {/* story も型どおりとは限らない（null でも止まらないように） */}
      <Blocks blocks={story?.content} />
    </div>
  );
}

const ALIGN_CLASSES = { left: "text-left", center: "text-center", right: "text-right" } as const;

/**
 * 配置のクラスを足す。決まった 3 つ以外は何も足さない
 */
function withAlign(base: string, attrs: { readonly textAlign?: unknown } | undefined): string {
  const align = attrs?.textAlign;
  return align === "left" || align === "center" || align === "right"
    ? `${base} ${ALIGN_CLASSES[align]}`
    : base;
}

/**
 * 子の一覧。配列でなければ空として扱い、オブジェクトでない要素（null など）は落とす
 * （型どおりでないデータで描画が止まらないように）
 */
function list<T>(items: readonly T[] | undefined): readonly T[] {
  return Array.isArray(items)
    ? items.filter((item) => typeof item === "object" && item !== null)
    : [];
}

/**
 * 空白でない文字が 1 文字でもあるか
 */
function hasText(inlines: readonly StoryInline[]): boolean {
  return inlines.some(
    (inline) =>
      inline.type === "text" && typeof inline.text === "string" && inline.text.trim().length > 0
  );
}

function Blocks({ blocks }: { blocks: readonly StoryBlock[] | undefined }) {
  return list(blocks).map((block, i) => <Block key={i} block={block} />);
}

function Block({ block }: { block: StoryBlock }) {
  switch (block.type) {
    case "paragraph": {
      const content = list(block.content);
      return (
        <p className={withAlign("mb-2.5 md:mb-3", block.attrs)}>
          {/* 空の段落（リーダーが空けた 1 行）も、1 行分の高さを残す */}
          {content.length > 0 ? <Inlines inlines={content} /> : <br />}
        </p>
      );
    }
    case "heading": {
      const content = list(block.content);
      // 文字の無い見出し（見出しの行の文字を消したもの）は、線だけが残るので描かない
      if (!hasText(content)) return null;
      if (block.attrs?.level === 2) {
        return (
          <h2
            className={withAlign(
              "mt-5 mb-1.5 border-l-4 border-orange-600 pl-2 text-[17px] leading-snug font-bold first:mt-0 md:mt-7 md:mb-2 md:pl-2.5 md:text-xl",
              block.attrs
            )}
          >
            <Inlines inlines={content} />
          </h2>
        );
      }
      if (block.attrs?.level === 3) {
        return (
          <h3
            className={withAlign(
              "mt-4 mb-1 text-[15px] leading-snug font-bold first:mt-0 md:mt-5 md:mb-1.5 md:text-[17px]",
              block.attrs
            )}
          >
            <Inlines inlines={content} />
          </h3>
        );
      }
      return null;
    }
    case "bulletList":
      return (
        <ul className="mb-2.5 list-disc pl-6 md:mb-3">
          <ListItems items={block.content} />
        </ul>
      );
    case "orderedList": {
      const start = block.attrs?.start;
      return (
        <ol
          start={Number.isSafeInteger(start) ? start : undefined}
          className="mb-2.5 list-decimal pl-6 md:mb-3"
        >
          <ListItems items={block.content} />
        </ol>
      );
    }
    case "image": {
      const src = block.attrs?.src;
      const alt = block.attrs?.alt;
      if (typeof src !== "string" || !isAllowedImageUrl(src)) return null;
      return (
        // next/image は使わない（ui-shared は next に依存しないため）
        <img
          src={src}
          alt={typeof alt === "string" ? alt : ""}
          loading="lazy"
          className="mx-auto my-2.5 block h-auto max-w-full rounded-md md:my-3 md:rounded-lg"
        />
      );
    }
    case "youtube":
      // 埋め込みは S-9（#321）で CSP の frame-src と一緒に入れる
      return null;
    default:
      return null;
  }
}

function ListItems({ items }: { items: readonly StoryListItem[] | undefined }) {
  return list(items).map((item, i) =>
    item.type === "listItem" ? (
      // 項目の中の段落・入れ子のリストは余白をなくし、項目どうしの間を詰める
      <li key={i} className="[&>ol]:mb-0 [&>p]:mb-0 [&>ul]:mb-0">
        <Blocks blocks={item.content} />
      </li>
    ) : null
  );
}

function Inlines({ inlines }: { inlines: readonly StoryInline[] }) {
  return inlines.map((inline, i) => {
    if (inline.type === "hardBreak") return <br key={i} />;
    if (inline.type === "text" && typeof inline.text === "string") {
      return <StoryText key={i} text={inline.text} marks={list(inline.marks)} />;
    }
    return null;
  });
}

/**
 * 文字に装飾を付ける。リンクを一番外側にする
 */
function StoryText({ text, marks }: { text: string; marks: readonly StoryMark[] }) {
  const has = (type: StoryMark["type"]) => marks.some((mark) => mark.type === type);
  let node: ReactNode = text;
  if (has("strike")) node = <s>{node}</s>;
  if (has("italic")) node = <em>{node}</em>;
  if (has("bold")) node = <strong className="font-bold">{node}</strong>;

  const link = marks.find((mark) => mark.type === "link");
  const href = link?.type === "link" ? link.attrs?.href : undefined;
  if (isHttpUrl(href)) {
    node = (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="text-orange-700 underline hover:text-orange-800"
      >
        {node}
      </a>
    );
  }
  return node;
}

/**
 * リンク先は `http://` か `https://` で始まり、URL として読めるものだけ（`ProjectStory` の検査と同じ基準）。
 * `https:/my/settings` のような書き方は、ブラウザでは自サイトへの相対リンクになるので断る
 */
function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || !/^https?:\/\//i.test(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
