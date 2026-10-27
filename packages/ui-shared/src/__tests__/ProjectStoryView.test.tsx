import type { ProjectStoryDocument } from "@physifun/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProjectStoryView } from "../ProjectStoryView";

/**
 * Issue #314: ストーリーの表示部品のテスト。
 *
 * HTML にして、許可したものが描かれること・許可していないものが出ないことを確かめる。
 * 保存時の検査を通らないデータ（型どおりでないもの）も渡すため、引数は unknown で受ける。
 */
const render = (doc: unknown) =>
  renderToStaticMarkup(<ProjectStoryView story={doc as ProjectStoryDocument} />);

const doc = (...content: unknown[]) => ({ type: "doc", content });
const text = (value: string, marks?: unknown[]) => ({ type: "text", text: value, marks });
const paragraph = (...content: unknown[]) => ({ type: "paragraph", content });

const ALLOWED_IMAGE = "https://abc.supabase.co/storage/v1/object/public/project-images/a.png";

describe("ProjectStoryView", () => {
  describe("許可した要素・装飾を描く", () => {
    it("見出し（h2 / h3）と段落を描く", () => {
      const html = render(
        doc(
          { type: "heading", attrs: { level: 2 }, content: [text("実現したいこと")] },
          { type: "heading", attrs: { level: 3 }, content: [text("小見出し")] },
          paragraph(text("本文です"))
        )
      );
      expect(html).toMatch(/<h2 class="[^"]*border-l-4[^"]*">実現したいこと<\/h2>/);
      expect(html).toMatch(/<h3 class="[^"]*">小見出し<\/h3>/);
      expect(html).toMatch(/<p class="[^"]*">本文です<\/p>/);
    });

    it("太字・斜体・取り消し線を描く", () => {
      const html = render(
        doc(
          paragraph(
            text("太字", [{ type: "bold" }]),
            text("斜体", [{ type: "italic" }]),
            text("取り消し", [{ type: "strike" }])
          )
        )
      );
      expect(html).toContain('<strong class="font-bold">太字</strong>');
      expect(html).toContain("<em>斜体</em>");
      expect(html).toContain("<s>取り消し</s>");
    });

    it("リンクは別タブで開き、rel に noopener noreferrer nofollow を付ける", () => {
      const html = render(
        doc(
          paragraph(
            text("サイト", [
              { type: "bold" },
              { type: "link", attrs: { href: "https://example.com/a" } },
            ])
          )
        )
      );
      expect(html).toMatch(
        /<a href="https:\/\/example.com\/a" target="_blank" rel="noopener noreferrer nofollow" class="[^"]*"><strong class="font-bold">サイト<\/strong><\/a>/
      );
    });

    it("箇条書きと番号付きリストを描く（番号の始まりも）", () => {
      const item = (value: string) => ({ type: "listItem", content: [paragraph(text(value))] });
      const html = render(
        doc(
          { type: "bulletList", content: [item("片付け"), item("壁塗り")] },
          { type: "orderedList", attrs: { start: 3 }, content: [item("三つめ")] }
        )
      );
      expect(html).toMatch(
        /<ul class="[^"]*list-disc[^"]*"><li [^>]*><p [^>]*>片付け<\/p><\/li><li/
      );
      expect(html).toMatch(
        /<ol start="3" class="[^"]*list-decimal[^"]*"><li [^>]*><p [^>]*>三つめ/
      );
    });

    it("許可したホストの画像を、代わりの文を付けて描く", () => {
      const html = render(
        doc({ type: "image", attrs: { src: ALLOWED_IMAGE, alt: "作業前の古民家" } })
      );
      expect(html).toContain(`<img src="${ALLOWED_IMAGE}" alt="作業前の古民家" loading="lazy"`);
    });

    it("代わりの文が無い画像は alt を空にする", () => {
      const html = render(doc({ type: "image", attrs: { src: ALLOWED_IMAGE } }));
      expect(html).toContain('alt=""');
    });

    it("配置を決まったクラスで描く", () => {
      const html = render(
        doc(
          { type: "paragraph", attrs: { textAlign: "center" }, content: [text("中央")] },
          {
            type: "heading",
            attrs: { level: 2, textAlign: "right" },
            content: [text("右")],
          }
        )
      );
      expect(html).toMatch(/<p class="[^"]* text-center">中央<\/p>/);
      expect(html).toMatch(/<h2 class="[^"]* text-right">右<\/h2>/);
    });

    it("改行を <br> で描き、空の段落も 1 行分の高さを残す", () => {
      const html = render(
        doc(paragraph(text("1 行目"), { type: "hardBreak" }, text("2 行目")), paragraph())
      );
      expect(html).toContain("1 行目<br/>2 行目");
      expect(html).toMatch(/<p class="[^"]*"><br\/><\/p><\/div>$/);
    });

    it("空の文書は何も描かない", () => {
      expect(render({ type: "doc" })).toMatch(/^<div class="[^"]*"><\/div>$/);
    });
  });

  describe("許可していないものは描かない", () => {
    it("知らない要素（script・iframe など）は中身ごと描かない", () => {
      const html = render(
        doc(
          { type: "script", content: [text("alert(1)")] },
          { type: "iframe", attrs: { src: "https://evil.example.com" } },
          paragraph(text("残る"))
        )
      );
      expect(html).not.toContain("<script");
      expect(html).not.toContain("<iframe");
      expect(html).not.toContain("alert(1)");
      expect(html).not.toContain("evil.example.com");
      expect(html).toContain("残る");
    });

    it("文字の中の HTML はエスケープして文字として出す", () => {
      const html = render(doc(paragraph(text('<img src=x onerror="alert(1)">'))));
      expect(html).not.toContain("<img");
      expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    });

    it("知らない属性（onclick・style など）は出さない", () => {
      const html = render(
        doc({
          type: "paragraph",
          attrs: { onclick: "alert(1)", style: "color:red", textAlign: "center;color:red" },
          content: [text("本文")],
        })
      );
      expect(html).not.toContain("onclick");
      expect(html).not.toContain("style");
      expect(html).not.toContain("color:red");
      expect(html).toMatch(/<p class="mb-2.5 md:mb-3">本文<\/p>/);
    });

    it("h1 などの許可していない見出しの段階は描かない", () => {
      const html = render(
        doc({ type: "heading", attrs: { level: 1 }, content: [text("大見出し")] })
      );
      expect(html).not.toContain("<h1");
      expect(html).not.toContain("大見出し");
    });

    it.each([
      ["javascript:", "javascript:alert(1)"],
      ["大文字の JAVASCRIPT:", "JAVASCRIPT:alert(1)"],
      ["data:", "data:text/html,<script>alert(1)</script>"],
      ["自サイトへの相対リンクになる https:/", "https:/my/settings"],
      ["文字列でない", 123],
    ])("%s のリンクは <a> にせず、文字だけ出す", (_, href) => {
      const html = render(doc(paragraph(text("押して", [{ type: "link", attrs: { href } }]))));
      expect(html).not.toContain("<a");
      expect(html).not.toContain("alert");
      expect(html).toContain("押して");
    });

    it.each([
      ["許可外のホスト", "https://evil.example.com/a.png"],
      ["http の Supabase", "http://abc.supabase.co/storage/v1/object/public/a.png"],
      ["javascript:", "javascript:alert(1)"],
      ["data:", "data:image/svg+xml,<svg onload=alert(1)>"],
    ])("%s の画像は描かない", (_, src) => {
      const html = render(doc({ type: "image", attrs: { src, alt: "画像" } }));
      expect(html).not.toContain("<img");
      expect(html).not.toContain("alert");
    });

    it("知らない装飾（code など）は無視して文字だけ出す", () => {
      const html = render(doc(paragraph(text("コード", [{ type: "code" }]))));
      expect(html).not.toContain("<code");
      expect(html).toContain("コード");
    });

    it("リストの直下に listItem 以外があっても描かない", () => {
      const html = render(doc({ type: "bulletList", content: [paragraph(text("直下の段落"))] }));
      expect(html).not.toContain("直下の段落");
    });

    it("YouTube は S-9（#321）まで描かない", () => {
      const html = render(doc({ type: "youtube", attrs: { videoId: "dQw4w9WgXcQ" } }));
      expect(html).not.toContain("<iframe");
      expect(html).not.toContain("dQw4w9WgXcQ");
    });
  });
});
