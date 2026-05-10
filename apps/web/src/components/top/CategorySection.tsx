"use client";

import { useState, type ReactElement } from "react";

const Clock = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </svg>
);
const Users = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20c0-3 3-5 6-5s6 2 6 5" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M14 19c1-2 3-3 6-3" />
  </svg>
);
const ArrowRight = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
const Grid = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);
const Hammer = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 4l6 6-3 3-6-6z" />
    <path d="M11 7l-7 7 3 3 7-7" />
  </svg>
);
const ChefHat = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 14c-2 0-3-1.5-3-3.5C3 8 5 7 7 7c0-3 8-3 8 0 2 0 4 1 4 3.5 0 2-1 3.5-3 3.5" />
    <path d="M6 14h12v5a1 1 0 01-1 1H7a1 1 0 01-1-1z" />
  </svg>
);
const Brush = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M16 3l5 5-9 9H7v-5z" />
    <path d="M7 17l-3 4 4-3" />
  </svg>
);
const Sprout = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 21V11" />
    <path d="M8 9c0-3 4-4 4 0 0-4 4-3 4 0 0 3-4 5-4 5s-4-2-4-5z" />
    <path d="M5 14c-2 0-3-2-3-4 2 0 4 1 4 4z" />
  </svg>
);
const Music = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 18V5l11-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="17" cy="16" r="3" />
  </svg>
);
const Camera = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 8h4l2-3h6l2 3h4v11H3z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);

type TabId = "all" | "diy" | "food" | "design" | "farm" | "art" | "media";

const TABS: { id: TabId; label: string; icon: ReactElement }[] = [
  { id: "all", label: "すべて", icon: <Grid /> },
  { id: "diy", label: "DIY・建築", icon: <Hammer /> },
  { id: "food", label: "料理・食", icon: <ChefHat /> },
  { id: "design", label: "デザイン・編集", icon: <Brush /> },
  { id: "farm", label: "農・自然", icon: <Sprout /> },
  { id: "art", label: "音楽・芸術", icon: <Music /> },
  { id: "media", label: "撮影・映像", icon: <Camera /> },
];

type FeaturedSample = {
  label: string;
  bg: string;
  tags: string[];
  title: string;
  sub: string;
  desc: string;
  hours: number;
  target: number;
  name: string;
  sns: string;
  initials: string;
  color: string;
};

type SideSample = {
  label: string;
  bg: string;
  tags: string[];
  title: string;
  sub: string;
  hours: number;
  people: number;
  name: string;
  sns: string;
  initials: string;
  color: string;
};

const SAMPLES: Record<TabId, [FeaturedSample, SideSample]> = {
  all: [
    {
      label: "WALL / DOZO",
      bg: "linear-gradient(160deg, #f3d3c3 0%, #c97a55 60%, #8c3f1f 100%)",
      tags: ["DIY・建築", "長野・松本"],
      title: "古民家の土壁を、3 日で塗り直したい。",
      sub: "左官の手ほどきで、家族の住まいを守る",
      desc: "築 120 年の母屋。雨漏りで傷んだ土壁を、左官職人と地域の人で塗り直します。漆喰の練り方から鏝の使い方まで、現場で学べます。寝食付き、初心者歓迎。",
      hours: 42,
      target: 60,
      name: "三輪 啓介",
      sns: "@miwa_keisuke",
      initials: "MK",
      color: "#c62828",
    },
    {
      label: "KITCHEN",
      bg: "linear-gradient(160deg, #f4dba0 0%, #c98842 60%, #7a4f1c 100%)",
      tags: ["料理・食", "鹿児島・与論"],
      title: "島の郷土料理を、1 冊にまとめたい。",
      sub: "撮影と編集の手をかしてください",
      hours: 23,
      people: 7,
      name: "島袋 文代",
      sns: "@shimabukuro_recipes",
      initials: "FS",
      color: "#a05536",
    },
  ],
  diy: [
    {
      label: "WALL / DOZO",
      bg: "linear-gradient(160deg, #f3d3c3 0%, #c97a55 60%, #8c3f1f 100%)",
      tags: ["DIY・建築", "長野・松本"],
      title: "古民家の土壁を、3 日で塗り直したい。",
      sub: "左官の手ほどきで、家族の住まいを守る",
      desc: "築 120 年の母屋。雨漏りで傷んだ土壁を、左官職人と地域の人で塗り直します。漆喰の練り方から鏝の使い方まで、現場で学べます。寝食付き、初心者歓迎。",
      hours: 42,
      target: 60,
      name: "三輪 啓介",
      sns: "@miwa_keisuke",
      initials: "MK",
      color: "#c62828",
    },
    {
      label: "ATELIER",
      bg: "linear-gradient(155deg, #efd0b8 0%, #b8552d 100%)",
      tags: ["DIY・建築", "宮崎・西米良"],
      title: "離れの工房を、みんなで建てる。",
      sub: "木材を伐り出すところから手をかけて",
      hours: 18,
      people: 5,
      name: "山内 直樹",
      sns: "@yamauchi_atelier",
      initials: "YN",
      color: "#b8552d",
    },
  ],
  food: [
    {
      label: "KITCHEN",
      bg: "linear-gradient(160deg, #f4dba0 0%, #c98842 60%, #7a4f1c 100%)",
      tags: ["料理・食", "鹿児島・与論"],
      title: "島の郷土料理を、1 冊にまとめたい。",
      sub: "撮影と編集の手をかしてください",
      desc: "おばあたちの台所に通って、消えかけているレシピを記録します。料理ができなくても OK。聞き書き、写真、レイアウト、それぞれの得意で参加できます。",
      hours: 23,
      target: 40,
      name: "島袋 文代",
      sns: "@shimabukuro_recipes",
      initials: "FS",
      color: "#a05536",
    },
    {
      label: "MISO",
      bg: "linear-gradient(155deg, #e9d39a 0%, #927437 100%)",
      tags: ["料理・食", "新潟"],
      title: "祖母の味噌仕込みを、世代を越えて記録する。",
      sub: "冬の 2 日間、台所から音と匂いをすくう",
      hours: 9,
      people: 3,
      name: "中田 真由",
      sns: "@nakata_miso",
      initials: "NM",
      color: "#927437",
    },
  ],
  design: [
    {
      label: "BOOKSHOP",
      bg: "linear-gradient(160deg, #d8c5e0 0%, #6c4d8a 60%, #3a2754 100%)",
      tags: ["デザイン・編集", "東京・台東"],
      title: "町の小さな本屋の、棚と看板を一緒につくる。",
      sub: "ロゴ刷新から棚板の塗装まで",
      desc: "店主と一緒に、棚のレイアウト、ロゴ、SNS の写真、什器の塗装まで。編集者・デザイナー・写真が好きな人の手をかしてください。週末 2 日 × 3 回。",
      hours: 36,
      target: 50,
      name: "永田 圭介",
      sns: "@nagata_records",
      initials: "KN",
      color: "#6c4d8a",
    },
    {
      label: "ZINE",
      bg: "linear-gradient(155deg, #cfd5e2 0%, #2a4a5e 100%)",
      tags: ["デザイン・編集", "東京"],
      title: "閉店した銭湯の記憶を、写真集にして残す。",
      sub: "聞き書き・写真整理・組版を分担",
      hours: 15,
      people: 6,
      name: "本棚 スタジオ",
      sns: "@hondana_studio",
      initials: "HS",
      color: "#2a4a5e",
    },
  ],
  farm: [
    {
      label: "TANADA",
      bg: "linear-gradient(160deg, #c5d6a4 0%, #5a6f3a 60%, #2e3a1c 100%)",
      tags: ["農・自然", "岡山・西粟倉"],
      title: "休耕田を、子どもたちの遊び場に変えたい。",
      sub: "畔の補修と、田んぼ開きの 1 日",
      desc: "10 年放置された田んぼを、地域の親子と一緒に再生します。重機の操作、草刈り、土運び、子どもの見守り — できる役回りで参加してください。お昼ごはん付き。",
      hours: 73,
      target: 100,
      name: "藤本 はる",
      sns: "@haru_tanada",
      initials: "HF",
      color: "#5a6f3a",
    },
    {
      label: "HARVEST",
      bg: "linear-gradient(155deg, #e3cfa6 0%, #8a6a30 100%)",
      tags: ["農・自然", "和歌山"],
      title: "梅の収穫から、シロップ仕込みまで。",
      sub: "祖父母の畑を 3 世代で受け継ぐ",
      hours: 21,
      people: 8,
      name: "井上 さくら",
      sns: "@inoue_ume",
      initials: "SI",
      color: "#8a6a30",
    },
  ],
  art: [
    {
      label: "TAIKO",
      bg: "linear-gradient(160deg, #e8b8a8 0%, #8a3a52 60%, #4a1d2a 100%)",
      tags: ["音楽・芸術", "石川・能登"],
      title: "夏祭りの太鼓を、子どもと一緒に新調する。",
      sub: "皮張りの伝統技と、お囃子の練習を 2 ヶ月で",
      desc: "古い太鼓の解体、皮張り、装飾、そして本番のお囃子練習まで。職人さんに教わりながら、子どもたちと作り上げます。最終日は地域の夏祭り本番。",
      hours: 19,
      target: 60,
      name: "夏祭りの会",
      sns: "@natsumatsuri.club",
      initials: "NT",
      color: "#8a3a52",
    },
    {
      label: "STAGE",
      bg: "linear-gradient(155deg, #e7b8b8 0%, #7a3030 100%)",
      tags: ["音楽・芸術", "京都"],
      title: "町家を改装した小さな劇場で、月例ライブを開く。",
      sub: "音響・照明・受付、それぞれの役で",
      hours: 12,
      people: 4,
      name: "大野 瑞希",
      sns: "@machiya_stage",
      initials: "MO",
      color: "#7a3030",
    },
  ],
  media: [
    {
      label: "DOC",
      bg: "linear-gradient(160deg, #c8d4e2 0%, #3a5a7a 60%, #1c2a3c 100%)",
      tags: ["撮影・映像", "北海道・室蘭"],
      title: "閉鎖が決まった工場を、最後の 1 ヶ月で映像に残す。",
      sub: "ドキュメンタリー制作、編集の手をかして",
      desc: "60 年動いてきた町工場の、最後の稼働を記録します。撮影、聞き書き、編集、字幕、それぞれの得意分野で参加してください。完成上映会は地元の公民館で。",
      hours: 31,
      target: 80,
      name: "大林 隼人",
      sns: "@obayashi.films",
      initials: "HO",
      color: "#3a5a7a",
    },
    {
      label: "PORTRAIT",
      bg: "linear-gradient(155deg, #d4c5b8 0%, #6a4f30 100%)",
      tags: ["撮影・映像", "長野"],
      title: "棚田を守る人たちのポートレートを、季節を追って撮る。",
      sub: "春夏秋冬、4 回の撮影行",
      hours: 8,
      people: 3,
      name: "田所 ゆき",
      sns: "@tadokoro_photo",
      initials: "YT",
      color: "#6a4f30",
    },
  ],
};

function Avatar({ initials, color }: { initials: string; color?: string }) {
  return (
    <span className="avatar" style={color ? { background: color } : undefined}>
      {initials}
    </span>
  );
}

export function CategorySection() {
  const [active, setActive] = useState<TabId>("diy");
  const [main, side] = SAMPLES[active] ?? SAMPLES.all;

  return (
    <section id="category" className="cat-root">
      <div className="catA">
        <div className="cat-head">
          <span className="eyebrow">
            <span className="dot" aria-hidden="true" />
            カテゴリから探す
          </span>
          <h2>
            あなたの<span className="em">得意</span>が、
            <br />
            誰かの<span className="em">願い</span>と出会う場所。
          </h2>
          <p className="lead">
            DIY、料理、デザイン、音楽、農作業 — ジャンルを横断して、
            いま動いているプロジェクトと、これから始まる物語を集めました。
          </p>
        </div>

        <div className="cat-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === active}
              className={`tab ${t.id === active ? "active" : ""}`}
              onClick={() => setActive(t.id)}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <div className="sample-stage" key={active}>
          <div className="grid">
            <article className="featured">
              <div className="pic img-ph" data-label={main.label} style={{ background: main.bg }}>
                <span className="badge-feat">サンプルプロジェクト</span>
                <div className="tags">
                  {main.tags.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
              </div>
              <div className="body">
                <h3>
                  {main.title}
                  <br />
                  <span
                    style={{
                      fontSize: "0.78em",
                      color: "var(--warm-ink-soft)",
                      fontWeight: 700,
                    }}
                  >
                    — {main.sub}
                  </span>
                </h3>
                {main.desc ? <p className="desc">{main.desc}</p> : null}
                <div className="hours-hero">
                  <Clock />
                  <span className="num">{main.hours}</span>
                  <span className="lab">時間が集まりました / 目標 {main.target} 時間</span>
                </div>
                <div className="meta">
                  <div className="who">
                    <Avatar initials={main.initials} color={main.color} />
                    <div>
                      <div className="name">{main.name} さん</div>
                      <div className="sns">{main.sns} ・ リーダー</div>
                    </div>
                  </div>
                  <span className="more">
                    くわしく見る <ArrowRight />
                  </span>
                </div>
              </div>
            </article>

            <div className="side">
              <article className="small side-only">
                <div className="pic img-ph" data-label={side.label} style={{ background: side.bg }}>
                  <span className="tag">{side.tags[0]}</span>
                </div>
                <div className="body">
                  <h4>{side.title}</h4>
                  <div className="who-sub">{side.sub}</div>
                  <div className="who">
                    <Avatar initials={side.initials} color={side.color} /> {side.sns}
                  </div>
                  <div className="stats">
                    <span className="stat">
                      <Clock />
                      <span className="num">{side.hours}</span>
                      <span className="unit">h</span>
                    </span>
                    <span className="stat">
                      <Users />
                      <span className="num">{side.people}</span>
                      <span className="unit">人</span>
                    </span>
                  </div>
                </div>
              </article>
              <div className="side-note">
                <p>
                  フィジファンには、いま{" "}
                  <b
                    style={{
                      fontFamily: "var(--font-en)",
                      fontSize: "1.4em",
                      color: "var(--pf-red)",
                    }}
                  >
                    119
                  </b>{" "}
                  件のプロジェクトが動いています。 ここに載っているのは、ほんの一例。
                </p>
                <a href="#all" className="side-link">
                  もっと見る <ArrowRight />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
