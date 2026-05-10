import Link from "next/link";

const CATS = [
  { label: "建築・古民家", cls: "cf-1" },
  { label: "カフェ・飲食", cls: "cf-2" },
  { label: "キャンプ場", cls: "cf-3" },
  { label: "農業", cls: "cf-4" },
  { label: "イベント", cls: "cf-5" },
  { label: "スポーツ", cls: "cf-6" },
];

const STATS = [
  { lab: "LEADERS", val: "012" },
  { lab: "PROJECTS", val: "034" },
  { lab: "SUPPORT HOURS", val: "1,280h" },
];

function Arrow() {
  return (
    <span className="btn-arrow" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12h14" />
        <path d="M13 5l7 7-7 7" />
      </svg>
    </span>
  );
}

export function HeroSection() {
  return (
    <section id="hero" className="hero-root">
      <div className="heroB">
        <div className="grid">
          <div className="left">
            <div>
              <span className="crumb">
                <span className="chip">FOR LEADERS</span>
                起案者を募集しています
              </span>

              <h1>
                あなたの<span className="em">「好き」</span>が、
                <br />
                誰かの<span className="em">「助け」</span>になる。
                <span className="sm">最高のフィジファン体験を。</span>
              </h1>

              <p className="sub">
                <span className="lp-nobr">フィジファン</span>は、
                <b>金銭ではなくスキルと時間</b>
                でプロジェクトを支援する
                <span className="lp-nobr">マッチングプラットフォーム</span>
                。古民家再生・米作り・DIY・キャンプ場運営──現場で一緒に汗をかいてくれる仲間と出会えます。
              </p>

              <div className="cta-row">
                <Link href="/apply" className="lp-btn btn-primary-terra">
                  プロジェクトをつくってみる
                  <Arrow />
                </Link>
                <p className="micro">
                  <b>公開は無料。</b>
                  <br />
                  成立まで手数料 0 円。いつでも辞められます。
                </p>
              </div>
            </div>

            <div>
              <div className="cat-pills">
                {CATS.map((c) => (
                  <span key={c.label} className={`cat ${c.cls}`}>
                    {c.label}
                  </span>
                ))}
              </div>
              <div className="footnote">
                {STATS.map((s) => (
                  <div key={s.lab} className="col">
                    <div className="lab">{s.lab}</div>
                    <div className="val">{s.val}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="right">
            <video autoPlay muted loop playsInline preload="metadata">
              <source src="/videos/hero.mp4" type="video/mp4" />
            </video>
            <div className="veil" aria-hidden="true" />

            <div className="quote-card">
              <div className="qmark" aria-hidden="true">
                &ldquo;
              </div>
              <div className="q">
                「完成品」よりも、
                <br />
                共に汗をかいた『時間』を贈りたい。
              </div>
              <div className="who">— PHYSIFUN MANIFESTO</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
