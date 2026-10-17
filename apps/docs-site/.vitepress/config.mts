/**
 * DB ドキュメントサイトの設定（VitePress。#280）
 *
 * 公開先: https://physicalfunding.github.io/PhysiFun/
 * ソースは scripts/prepare-content.ts が集めた .content/（載せる範囲は DB 関連だけ）。
 * 運用手順は docs/guides/db-migration.md §6 を参照。
 */
import { readFileSync } from "node:fs";
import { defineConfig, type DefaultTheme } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

const SITE_URL = "https://physicalfunding.github.io/PhysiFun/";
const REPO_URL = "https://github.com/Physicalfunding/PhysiFun";

/** tbls の schema.json のうち、サイドバーを作るのに使う部分 */
interface TblsSchema {
  tables: { name: string }[];
  viewpoints?: { id?: string; name: string }[];
}

const schema: TblsSchema = JSON.parse(
  readFileSync(new URL("../../../docs/db/schema.json", import.meta.url), "utf8")
);

/** "public.accounts" → "accounts" */
const shortName = (tableName: string): string => tableName.replace(/^public\./, "");

function dbSidebar(): DefaultTheme.SidebarItem[] {
  return [
    { text: "索引", link: "/db/README" },
    {
      text: "領域別のビュー",
      items: (schema.viewpoints ?? [])
        .filter((v) => v.id)
        .map((v) => ({ text: v.name, link: `/db/viewpoint-${v.id}` })),
    },
    {
      text: "テーブル",
      collapsed: false,
      items: schema.tables
        .map((t) => t.name)
        .sort((a, b) => shortName(a).localeCompare(shortName(b)))
        .map((name) => ({ text: shortName(name), link: `/db/${name}` })),
    },
  ];
}

const specSidebar: DefaultTheme.SidebarItem[] = [
  { text: "03. データモデル", link: "/specs/03_data-model" },
  { text: "02. ドメインモデル", link: "/specs/02_domain-model" },
];

export default withMermaid(
  defineConfig({
    lang: "ja",
    title: "PhysiFun DB ドキュメント",
    description: "PhysiFun のテーブル定義書・ER 図・設計書（atlas/schema.sql から自動生成）",
    base: "/PhysiFun/",
    srcDir: ".content",
    // tbls のファイル名（public.accounts.md）にドットが含まれるため、.html 付きの URL のままにする
    cleanUrls: false,
    // .content/ の中は自動生成・コピーなので、git の更新日時は取れない
    lastUpdated: false,
    // Mermaid のライブラリが大きく、既定の 500 kB を超えて警告が出るため上限を上げる（動作には影響しない）
    vite: { build: { chunkSizeWarningLimit: 2500 } },
    themeConfig: {
      nav: [
        { text: "テーブル定義書", link: "/db/README" },
        // 動く ER 図は VitePress のページではない（public/er/ に置いた静的サイト）ので、URL で指定する
        { text: "動く ER 図", link: `${SITE_URL}er/`, target: "_self" },
        {
          text: "設計",
          items: [
            { text: "03. データモデル", link: "/specs/03_data-model" },
            { text: "02. ドメインモデル", link: "/specs/02_domain-model" },
          ],
        },
      ],
      sidebar: {
        "/db/": dbSidebar(),
        "/specs/": specSidebar,
      },
      socialLinks: [{ icon: "github", link: REPO_URL }],
      outline: { level: [2, 3], label: "このページの内容" },
      docFooter: { prev: "前のページ", next: "次のページ" },
      darkModeSwitchLabel: "表示モード",
      sidebarMenuLabel: "メニュー",
      returnToTopLabel: "ページの先頭へ",
      footer: {
        message:
          "テーブル定義書と ER 図は atlas/schema.sql から tbls で自動生成しています。手で編集しないでください。",
      },
      search: {
        provider: "local",
        options: {
          miniSearch: {
            options: {
              // 日本語は空白で区切られないので、Intl.Segmenter で単語に分ける。
              // この関数は文字列にしてブラウザにも送られる（検索語も同じ方法で区切る）ため、
              // 外側の変数や import を参照しない、自己完結した関数にしておく。
              tokenize: (text: string) => {
                if (typeof Intl === "object" && "Segmenter" in Intl) {
                  const segmenter = new Intl.Segmenter("ja", { granularity: "word" });
                  return Array.from(segmenter.segment(text))
                    .filter((s) => s.isWordLike)
                    .map((s) => s.segment);
                }
                return text.split(/[\s\p{P}]+/u).filter(Boolean);
              },
            },
            // 「公開 申請」のように区切られた語は、すべてを含むページだけを出す
            searchOptions: { combineWith: "AND" },
          },
          translations: {
            button: { buttonText: "検索", buttonAriaLabel: "検索" },
            modal: {
              displayDetails: "詳細を表示",
              resetButtonTitle: "検索語を消す",
              backButtonTitle: "検索を閉じる",
              noResultsText: "見つかりませんでした",
              footer: {
                selectText: "選ぶ",
                navigateText: "移動",
                closeText: "閉じる",
              },
            },
          },
        },
      },
    },
  })
);
