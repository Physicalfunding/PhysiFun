/* eslint-disable */
/* global React */

const PIcon = {
  Edit: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3l5 5-12 12H4v-5z" />
      <path d="M14 5l5 5" />
    </svg>
  ),
  Chat: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a3 3 0 01-3 3H8l-5 4V6a3 3 0 013-3h12a3 3 0 013 3z" />
    </svg>
  ),
  Megaphone: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11v2l11 5V6z" />
      <path d="M14 8h3a3 3 0 010 6h-3" />
      <path d="M7 18l1 4h3l-1-4" />
    </svg>
  ),
  Hands: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 11V5a2 2 0 014 0v6" />
      <path d="M12 11V4a2 2 0 014 0v9" />
      <path d="M16 11V6a2 2 0 014 0v10c0 3-3 6-7 6s-6-2-7-4l-3-6a2 2 0 013-2l2 3" />
    </svg>
  ),
  Sparkle: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
      <circle cx="12" cy="12" r="3.4" />
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12l5 5L20 7" />
    </svg>
  ),
  Clock: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  ),
  Arrow: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  ArrowDown: () => (
    <svg viewBox="0 0 18 32" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2v26M3 22l6 6 6-6" />
    </svg>
  ),
  Star: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l2.6 6 6.4.6-4.8 4.4 1.4 6.5L12 17l-5.6 3.5 1.4-6.5L3 9.6 9.4 9z" />
    </svg>
  ),
};

const STEPS = [
  {
    n: 1, dur: "10 分",
    title: "やってみたいことを書く",
    icon: <PIcon.Edit />,
    desc: "難しい計画書はいりません。「何を、どこで、どんな風に実現したいか」を、自分の言葉でフォームに。下書き保存できます。",
    checks: ["フォーム入力 10 分程度", "途中保存 OK", "写真 1 枚あれば十分"],
    tip: "完璧じゃなくて大丈夫。まずは話の種です",
    who: "リーダー（あなた）",
    quote: { text: "最初は不安だったけど、書いてみたら自分の頭の中が整理された。", by: "DIY 案件 / 三輪さん" },
  },
  {
    n: 2, dur: "1 週間",
    title: "コーディネーターと話す",
    icon: <PIcon.Chat />,
    desc: "オンラインまたは対面で 30 〜 60 分。やりたいことを一緒に整理して、必要なスキル・時間・場所を見える化していきます。",
    checks: ["zoom or 現地", "60 分程度", "費用は無料"],
    tip: "1 人で抱え込まずに、伴走する人がいます",
    who: "リーダー × 運営",
    quote: { text: "私が言葉にできなかった『願い』を、ちゃんと拾ってくれた。", by: "料理案件 / 島袋さん" },
  },
  {
    n: 3, dur: "2〜4 週間",
    title: "サポーターを募集する",
    icon: <PIcon.Megaphone />,
    desc: "プロジェクトページを公開して、フィジファンを通じて時間とスキルを募ります。SNS や地域ネットワークと連携して広がっていきます。",
    checks: ["ページ作成は運営が支援", "進捗時間が見える化", "途中で内容調整 OK"],
    tip: "人が集まりやすい時期を一緒に考えます",
    who: "運営 + みんな",
    quote: { text: "知らない人が手を挙げてくれて、本当に驚いた。", by: "農・自然 / 藤本さん" },
  },
  {
    n: 4, dur: "現場へ",
    title: "プロジェクトを実行する",
    icon: <PIcon.Hands />,
    desc: "集まった仲間と現場を動かします。事前打ち合わせから当日の段取り、安全管理まで運営がサポート。終わったらリターン（贈り物・記録・関係性）を残します。",
    checks: ["保険対応あり", "撮影・記録サポート", "リターンの設計支援"],
    tip: "現場に残る『関係性』こそが最大のリターン",
    who: "全員",
    quote: { text: "終わった後も、サポーターの皆と連絡を取り合っています。", by: "DIY 案件 / 山内さん" },
  },
];

/* ==========================================================
   共通ヘッダ
   ========================================================== */
function ProcHead() {
  return (
    <div className="proc-head">
      <span className="eyebrow"><span className="dot"></span>はじめかた</span>
      <h2>
        書いて、<span className="em">話して</span>、<br />
        集めて、<span className="em">動かす</span>。
      </h2>
      <p className="lead">
        リーダーになるのに、特別な資格はいりません。
        小さな「やってみたい」を、4 ステップで現場まで運びます。
      </p>
    </div>
  );
}

/* ==========================================================
   案 A — 横スパインステップ
   ========================================================== */
function ProcessA({ mobile = false }) {
  return (
    <div className={`proc-root procA ${mobile ? "mobile" : ""}`}>
      <ProcHead />
      <div className="steps">
        <div className="spine"></div>
        {STEPS.map((s) => (
          <div key={s.n} className="step">
            <div className="num-circle">
              {String(s.n).padStart(2, "0")}
              <span className="dur">{s.dur}</span>
            </div>
            <div className="icon-box">{s.icon}</div>
            <h3>{s.title}</h3>
            <p>{s.desc}</p>
            <div className="tip">{s.tip}</div>
          </div>
        ))}
      </div>
      <div className="footer-cta">
        <div className="text">
          <b>30 分の無料相談から</b>はじめられます。<br />
          オンライン / 対面、どちらでも。
        </div>
        <a href="#apply">無料相談を申し込む <PIcon.Arrow /></a>
      </div>
    </div>
  );
}

/* ==========================================================
   案 B — カード積層型
   ========================================================== */
function ProcessB({ mobile = false }) {
  return (
    <div className={`proc-root procB ${mobile ? "mobile" : ""}`}>
      <ProcHead />
      <div className="stack">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.n}>
            <article className="card">
              <div className="num">{String(s.n).padStart(2, "0")}</div>
              <div className="body">
                <div className="meta-row">
                  <span className="who">{s.who}</span>
                  <span className="dur-pill"><PIcon.Clock /> {s.dur}</span>
                </div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
                <div className="checks">
                  {s.checks.map((c) => (
                    <span key={c}><PIcon.Check />{c}</span>
                  ))}
                </div>
              </div>
              <div className="visual">{s.icon}</div>
            </article>
            {i < STEPS.length - 1 ? (
              <div className="arrow-down"><PIcon.ArrowDown /></div>
            ) : null}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/* ==========================================================
   案 C — 旅路型（ジグザグ）
   ========================================================== */
function ProcessC({ mobile = false }) {
  return (
    <div className={`proc-root procC ${mobile ? "mobile" : ""}`}>
      <ProcHead />
      <div className="journey">
        {STEPS.map((s, i) => {
          const side = i % 2 === 0 ? "right" : "left";
          return (
            <div key={s.n} className={`scene ${side}`}>
              <div className="visual">
                <div className="meta">STEP {String(s.n).padStart(2, "0")} ・ {s.who}</div>
                <div className="dur">{s.dur}<span className="unit"></span></div>
                <div className="desc">{s.tip}</div>
              </div>
              <div className="pip">{s.n}</div>
              <div className="panel">
                <div className="icon-row">
                  <span className="ico">{s.icon}</span>
                  <span className="label">{s.who}</span>
                </div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
                <div className="quote">
                  {s.quote.text}
                  <em>— {s.quote.by}</em>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="end-mark">
        <span className="star"><PIcon.Star /></span>
        <div className="text">そして、また誰かの旅へ。</div>
      </div>
    </div>
  );
}

Object.assign(window, { ProcessA, ProcessB, ProcessC });
