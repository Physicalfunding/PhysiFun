/* global React */

const SIcon = {
  Compass: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M16 8l-2 6-6 2 2-6z" />
    </svg>
  ),
  Shield: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  Camera: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h4l2-3h6l2 3h4v11H3z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  ),
  Network: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="6" r="2.5" />
      <circle cx="5" cy="18" r="2.5" />
      <circle cx="19" cy="18" r="2.5" />
      <path d="M12 8.5v3M10 12h4M10 14l-4 2M14 14l4 2" />
    </svg>
  ),
  Wallet: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7v12a2 2 0 002 2h14a2 2 0 002-2v-9H5a2 2 0 010-3h14V7" />
      <circle cx="17" cy="14" r="1.2" />
    </svg>
  ),
  Book: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h7a3 3 0 013 3v14H7a3 3 0 01-3-3z" />
      <path d="M20 4h-7a3 3 0 00-3 3v14h7a3 3 0 003-3z" />
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12l5 5L20 7" />
    </svg>
  ),
};

const SUPPORTS = [
  { ico: <SIcon.Compass />, title: "コーディネーター伴走", desc: "応募から実行まで、専任の伴走者が一緒に考えます。1 人で抱え込まなくて大丈夫。", meta: "30 分の無料面談から" },
  { ico: <SIcon.Shield />, title: "保険・安全管理", desc: "活動中の事故に備えた保険を運営側で手配。安全マニュアル、リスク事前チェックも標準装備。", meta: "全プロジェクト適用" },
  { ico: <SIcon.Camera />, title: "撮影・記録サポート", desc: "プロジェクトページ用の写真撮影、現場記録、リターン用の冊子制作まで。専属クルーが入ります。", meta: "希望者は無料で" },
  { ico: <SIcon.Network />, title: "サポーター募集の発信", desc: "フィジファンの登録メンバー 2,800+ と SNS 発信で、知らない誰かを引き寄せます。", meta: "登録 2,800+ 名" },
  { ico: <SIcon.Wallet />, title: "費用ゼロで始められる", desc: "リーダー登録、コーディネート、保険、ページ運用 — 始める時にお金はかかりません。", meta: "登録費 0 円" },
  { ico: <SIcon.Book />, title: "終わったあとも、つながる", desc: "終了後の振り返り会、リーダー同士の交流会、次のプロジェクトの相談まで。長く伴走します。", meta: "OB/OG コミュニティ" },
];

const COMPARE = [
  { label: "費用負担", sub: "立ち上げに必要なお金", us: { check: true, txt: "0 円から始められる" }, other: "イベント費用は自己負担" },
  { label: "支援の集まり方", sub: "誰が、何を持ち寄るか", us: { check: true, txt: "時間とスキルで支える" }, other: "金銭的なリターン目的が中心" },
  { label: "伴走者", sub: "困った時に話せる相手", us: { check: true, txt: "専任コーディネーター" }, other: "基本的に自走" },
  { label: "保険・安全", sub: "現場のリスク管理", us: { check: true, txt: "運営が手配・標準装備" }, other: "個別対応が必要" },
  { label: "終わったあと", sub: "プロジェクト後の関係性", us: { check: true, txt: "OB/OG コミュニティで継続" }, other: "終了後は基本ノータッチ" },
];

const STATEMENTS = [
  { pill: "WHY 01", h: "「お金じゃない支え合い」を、続けられるしくみに。", p: "クラファンは目標達成すれば終わる。私たちは、終わってからも続く関係性こそが本当のリターンだと考えます。", label: "私たちがすること", ico: <SIcon.Network />, items: ["時間・スキルでの支援を可視化する登録のしくみ", "終了後も繋がれる OB/OG コミュニティ運営", "別プロジェクトへの『循環』を伴走"] },
  { pill: "WHY 02", h: "リーダーが孤立しない、専任の伴走を。", p: "やりたいことはあるけど、ひとりじゃ無理 — そう思って動けない人を、ひとりにしません。応募から実行までずっと隣にいます。", label: "私たちがすること", ico: <SIcon.Compass />, items: ["30 分の無料相談（オンライン / 対面）", "プロジェクト設計の壁打ちと整理", "サポーター募集の発信代行"] },
  { pill: "WHY 03", h: "現場に、安心して立てる準備を。", p: "DIY も、農作業も、撮影も、現場にはリスクがあります。リーダーが安心して当日を迎えられる環境を、運営が整えます。", label: "私たちがすること", ico: <SIcon.Shield />, items: ["活動保険を全プロジェクト標準で適用", "安全マニュアルと事前リスクチェック", "現場の記録・撮影クルー派遣"] },
];

function SupHead() {
  return (
    <div className="sup-head">
      <span className="eyebrow"><span className="dot"></span>サポート体制</span>
      <h2>
        ひとりで、<br />
        <span className="em">背負わなくていい</span>。
      </h2>
      <p className="lead">
        プロジェクトを立ち上げる人が、安心して現場に立てるように。
        運営からの伴走と、しくみで支えます。
      </p>
    </div>
  );
}

/* ==========================================================
   案 A — 6 つのサポート / グリッド
   ========================================================== */
function SupportA({ mobile = false }) {
  return (
    <div className={`sup-root supA ${mobile ? "mobile" : ""}`}>
      <SupHead />
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
  );
}

/* ==========================================================
   案 B — 比較表型
   ========================================================== */
function SupportB({ mobile = false }) {
  return (
    <div className={`sup-root supB ${mobile ? "mobile" : ""}`}>
      <SupHead />
      <div className="table">
        <div className="row head">
          <div className="cell">項目</div>
          <div className="cell us">フィジファン</div>
          <div className="cell">ふつうの場で</div>
        </div>
        {COMPARE.map((c, i) => (
          <div key={i} className="row">
            <div className="cell label" data-mlabel="項目">
              {c.label}
              <span className="sub">{c.sub}</span>
            </div>
            <div className="cell us" data-mlabel="フィジファン">
              <span className="check"><SIcon.Check />{c.us.txt}</span>
            </div>
            <div className="cell" data-mlabel="ふつうの場で">
              <span className="x">— {c.other}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="footnote">※ 一般的な市民活動・クラウドファンディングとの比較。フィジファン運営調べ / 2025 年</div>
    </div>
  );
}

/* ==========================================================
   案 C — ステートメント縦積み
   ========================================================== */
function SupportC({ mobile = false }) {
  return (
    <div className={`sup-root supC ${mobile ? "mobile" : ""}`}>
      <SupHead />
      <div className="stack">
        {STATEMENTS.map((s, i) => (
          <div key={i} className="row">
            <div className="left">
              <span className="pill">{s.pill}</span>
              <h3>{s.h}</h3>
              <p>{s.p}</p>
            </div>
            <div className="right">
              <div className="ico-row">
                <span className="ico">{s.ico}</span>
                <span className="label">{s.label}</span>
              </div>
              <ul>
                {s.items.map((it, j) => <li key={j}>{it}</li>)}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { SupportA, SupportB, SupportC });
