import { ProjectStory, type ProjectStoryDocument } from "@physifun/domain";
import type { Json } from "../database/kysely/types";

// #315 のつなぎ。DB の本文（projects.story）は文書データになったが、domain と DTO はまだ文字の本文なので、ここで変える。
// domain・DTO を文書データに切り替えるとき（同じ #315 の次のコミット）に消す。

/** 文書データ → 文字の本文（段落を改行でつなぐ） */
export function storyToText(story: unknown): string | null {
  if (story === null) return null;
  return ((story as ProjectStoryDocument).content ?? [])
    .flatMap((block) =>
      block.type === "paragraph"
        ? [(block.content ?? []).map((i) => (i.type === "text" ? i.text : "\n")).join("")]
        : []
    )
    .join("\n");
}

/** 文字の本文 → 文書データ（1 行を 1 段落にする） */
export function textToStory(text: string | null): Json | null {
  if (text === null) return null;
  const story = ProjectStory.fromPlainText(text);
  if (!story.ok) throw new Error(`Invalid story: ${JSON.stringify(story.error)}`);
  return story.value.toJSON() as unknown as Json;
}
