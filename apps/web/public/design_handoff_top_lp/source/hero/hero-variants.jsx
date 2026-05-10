/* global React */

const Arrow = () => (
  <span className="btn-arrow">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14"></path>
      <path d="M13 5l7 7-7 7"></path>
    </svg>
  </span>
);

const CATS = [
  { label: "建築・古民家", cls: "cf-1" },
  { label: "カフェ・飲食", cls: "cf-2" },
  { label: "キャンプ場", cls: "cf-3" },
  { label: "農業", cls: "cf-4" },
  { label: "イベント", cls: "cf-5" },
  { label: "スポーツ", cls: "cf-6" },
];

const CategoryPills = ({ short = false }) => (
  <div className="cat-pills">
    {(short ? CATS.slice(0, 4) : CATS).map((c) => (
      <span key={c.label} className={`cat ${c.cls}`}>{c.label}</span>
    ))}
  </div>
);

const NavItems = () => (
  <>
    <a className="nav-item" href="#">サービス</a>
    <a className="nav-item" href="#">事例</a>
    <a className="nav-item" href="#">料金</a>
    <a className="nav-item" href="#">FAQ</a>
  </>
);

/* ============== 案 A ============== */
function HeroA({ mobile = false }) {
  return (
    <div className={`hero-root heroA ${mobile ? "mobile" : ""}`}>
      <header className="topbar">
        <div className="logo">
          <img src="references/フィジファン_ロゴ_黒.png" alt="フィジファン" />
        </div>
        <nav className="nav"><NavItems /></nav>
        <a href="/apply" className="apply">プロジェクトをつくる</a>
      </header>

      <div className="cats">
        <CategoryPills short={mobile} />
      </div>

      <section className="stage">
        <video src="references/hero.mp4" autoPlay muted loop playsInline />
      </section>

      <section className="band">
        <div className="container">
          <h1>
            あなたの<span className="em">「好き」</span>が、<br />
            誰かの<span className="em">「助け」</span>になる。
          </h1>
          <p className="sub">
            フィジファンは、金銭ではなく <b>スキルと時間</b> でプロジェクトを支援するマッチングプラットフォーム。
            <br className="hidden-mobile" />
            古民家再生、米作り、DIY、キャンプ場運営──現場で一緒に汗をかいてくれる仲間と出会えます。
          </p>
          <div className="origin">フィジカル × クラウドファンディング ＝ フィジファン</div>
          <div className="cta-row">
            <a href="/apply" className="btn btn-on-photo">
              プロジェクトをつくってみる
              <Arrow />
            </a>
            <span className="micro">公開は無料 ／ 成立まで手数料 0 円</span>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ============== 案 B ============== */
function HeroB({ mobile = false }) {
  return (
    <div className={`hero-root heroB ${mobile ? "mobile" : ""}`}>
      <header className="topbar">
        <div className="logo">
          <img src="references/フィジファン_ロゴ_黒.png" alt="フィジファン" />
        </div>
        <nav className="nav"><NavItems /></nav>
        <a href="/apply" className="apply">プロジェクトをつくる</a>
      </header>

      <div className="grid">
        <div className="left">
          <div>
            <span className="crumb">
              <span className="chip">FOR LEADERS</span>
              起案者を募集しています
            </span>

            <h1>
              あなたの<span className="em">「好き」</span>が、<br />
              誰かの<span className="em">「助け」</span>になる。
              <span className="sm">最高のフィジファン体験を。</span>
            </h1>

            <p className="sub">
              フィジファンは、<b>金銭ではなくスキルと時間</b>でプロジェクトを支援するマッチングプラットフォーム。
              古民家再生・米作り・DIY・キャンプ場運営──現場で一緒に汗をかいてくれる仲間と出会えます。
            </p>

            <div className="cta-row">
              <a href="/apply" className="btn btn-primary-terra">
                プロジェクトをつくってみる
                <Arrow />
              </a>
              <p className="micro">
                <b>公開は無料。</b><br />
                成立まで手数料 0 円。いつでも辞められます。
              </p>
            </div>
          </div>

          <div>
            <CategoryPills short={mobile} />
            <div className="footnote">
              <div className="col"><div className="lab">LEADERS</div><div className="val">012</div></div>
              <div className="col"><div className="lab">PROJECTS</div><div className="val">034</div></div>
              <div className="col"><div className="lab">SUPPORT HOURS</div><div className="val">1,280h</div></div>
            </div>
          </div>
        </div>

        <div className="right">
          <video src="references/hero.mp4" autoPlay muted loop playsInline />
          <div className="veil"></div>
          <div className="frame"></div>

          <span className="badge">
            <span className="dot"></span>
            REC ／ 現場の風景
          </span>

          <div className="quote-card">
            <div className="qmark">“</div>
            <div className="q">
              「完成品」よりも、<br />
              共に汗をかいた『時間』を贈りたい。
            </div>
            <div className="who">— PHYSIFUN MANIFESTO</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============== 案 C ============== */
function HeroC({ mobile = false }) {
  return (
    <div className={`hero-root heroC ${mobile ? "mobile" : ""}`}>
      <header className="topbar">
        <div className="logo">
          <img src="references/フィジファン_ロゴ_黒.png" alt="フィジファン" />
        </div>
        <nav className="nav"><NavItems /></nav>
        <a href="/apply" className="apply">プロジェクトをつくる</a>
      </header>

      <section className="stage">
        <video src="references/hero.mp4" autoPlay muted loop playsInline />
        <div className="grad-side"></div>
        <div className="grad"></div>

        <div className="cats-overlay">
          <CategoryPills short={mobile} />
        </div>

        <div className="copy-bottom">
          <h1>
            あなたの<span className="em">「好き」</span>が、誰かの<span className="em">「助け」</span>になる。
          </h1>
          <div className="cta-row">
            <a href="/apply" className="btn btn-on-photo">
              プロジェクトをつくってみる
              <Arrow />
            </a>
            <span className="micro">公開は無料 ／ 手数料 0 円</span>
          </div>
        </div>
      </section>

      <div className="strip">
        <span className="lab">
          <span className="iconbox"><img src="references/フィジファン_シンボル_黒.png" alt="" /></span>
          現場共創サービス
        </span>
        <div className="stats">
          <div className="col"><div className="lab2">LEADERS</div><div className="val">012</div></div>
          <div className="col"><div className="lab2">PROJECTS</div><div className="val">034</div></div>
          <div className="col"><div className="lab2">SUPPORT HOURS</div><div className="val">1,280h</div></div>
        </div>
        <span className="scroll">SCROLL <span className="line"></span></span>
      </div>
    </div>
  );
}

window.HeroA = HeroA;
window.HeroB = HeroB;
window.HeroC = HeroC;
