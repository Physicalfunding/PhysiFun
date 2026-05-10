import type { ReactElement } from "react";

const Compass = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M16 8l-2 6-6 2 2-6z" />
  </svg>
);
const Shield = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);
const Camera = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 8h4l2-3h6l2 3h4v11H3z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);
const Network = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="6" r="2.5" />
    <circle cx="5" cy="18" r="2.5" />
    <circle cx="19" cy="18" r="2.5" />
    <path d="M12 8.5v3M10 12h4M10 14l-4 2M14 14l4 2" />
  </svg>
);
const Wallet = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7v12a2 2 0 002 2h14a2 2 0 002-2v-9H5a2 2 0 010-3h14V7" />
    <circle cx="17" cy="14" r="1.2" />
  </svg>
);
const Book = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h7a3 3 0 013 3v14H7a3 3 0 01-3-3z" />
    <path d="M20 4h-7a3 3 0 00-3 3v14h7a3 3 0 003-3z" />
  </svg>
);

type Item = { ico: ReactElement; title: string; desc: string; meta: string };

const SUPPORTS: Item[] = [
  {
    ico: <Compass />,
    title: "コーディネーター伴走",
    desc: "応募から実行まで、専任の伴走者が一緒に考えます。1 人で抱え込まなくて大丈夫。",
    meta: "30 分の無料面談から",
  },
  {
    ico: <Shield />,
    title: "保険・安全管理",
    desc: "活動中の事故に備えた保険を運営側で手配。安全マニュアル、リスク事前チェックも標準装備。",
    meta: "全プロジェクト適用",
  },
  {
    ico: <Camera />,
    title: "撮影・記録サポート",
    desc: "プロジェクトページ用の写真撮影、現場記録、リターン用の冊子制作まで。専属クルーが入ります。",
    meta: "希望者は無料で",
  },
  {
    ico: <Network />,
    title: "サポーター募集の発信",
    desc: "フィジファンの登録メンバー 2,800+ と SNS 発信で、知らない誰かを引き寄せます。",
    meta: "登録 2,800+ 名",
  },
  {
    ico: <Wallet />,
    title: "費用ゼロで始められる",
    desc: "リーダー登録、コーディネート、保険、ページ運用 — 始める時にお金はかかりません。",
    meta: "登録費 0 円",
  },
  {
    ico: <Book />,
    title: "終わったあとも、つながる",
    desc: "終了後の振り返り会、リーダー同士の交流会、次のプロジェクトの相談まで。長く伴走します。",
    meta: "OB/OG コミュニティ",
  },
];

export function SupportSection() {
  return (
    <section id="support" className="sup-root">
      <div className="supA">
        <div className="sup-head">
          <span className="eyebrow">
            <span className="dot" aria-hidden="true" />
            サポート体制
          </span>
          <h2>
            ひとりで、
            <br />
            <span className="em">背負わなくていい</span>。
          </h2>
          <p className="lead">
            プロジェクトを立ち上げる人が、安心して現場に立てるように。
            運営からの伴走と、しくみで支えます。
          </p>
        </div>

        <div className="grid">
          {SUPPORTS.map((s, i) => (
            <article key={i} className="item">
              <span className="ico">{s.ico}</span>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
              <div className="meta">{s.meta}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
