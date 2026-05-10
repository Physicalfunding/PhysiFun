/* global React */

/* ==========================================================
   ライン SVG アイコン（Lucide ベースの統一スタイル）
   ========================================================== */
const Icon = {
  // 中央: 星（あなたの得意なこと）
  Sparkle: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
      <circle cx="12" cy="12" r="3.4" />
    </svg>
  ),
  // 中央: フラッグ（実現したいこと）
  Flag: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4v17" />
      <path d="M5 5c4-2 7 2 11 0v9c-4 2-7-2-11 0" />
    </svg>
  ),
  // 中央: ギフト（リターン）
  Gift: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="9" width="18" height="11" rx="1.5" />
      <path d="M3 13h18M12 9v11" />
      <path d="M8 9c-1.5-3 1-5 4-2 3-3 5.5-1 4 2" />
    </svg>
  ),
  // スキル例
  Hammer: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4l6 6-3 3-6-6z" />
      <path d="M11 7l-7 7 3 3 7-7" />
      <path d="M5 16l-2 5 5-2" />
    </svg>
  ),
  Sprout: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21V11" />
      <path d="M8 9c0-3 4-4 4 0 0-4 4-3 4 0 0 3-4 5-4 5s-4-2-4-5z" />
      <path d="M5 14c-2 0-3-2-3-4 2 0 4 1 4 4z" />
    </svg>
  ),
  ChefHat: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 14c-2 0-3-1.5-3-3.5C3 8 5 7 7 7c0-3 8-3 8 0 2 0 4 1 4 3.5 0 2-1 3.5-3 3.5" />
      <path d="M6 14h12v5a1 1 0 01-1 1H7a1 1 0 01-1-1z" />
    </svg>
  ),
  Brush: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3l5 5-9 9H7v-5z" />
      <path d="M7 17l-3 4 4-3" />
    </svg>
  ),
  // ゴール例
  Home: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z" />
    </svg>
  ),
  Tent: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21l9-15 9 15" />
      <path d="M12 6v15M9 21l3-5 3 5" />
    </svg>
  ),
  Wheat: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21V8" />
      <path d="M12 12c-3-1-4-3-3-6 3 1 4 3 3 6zM12 12c3-1 4-3 3-6-3 1-4 3-3 6zM12 8c-3-1-4-3-3-6 3 1 4 3 3 6zM12 8c3-1 4-3 3-6-3 1-4 3-3 6z" />
    </svg>
  ),
  PartyPopper: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 22l5-14 9 9z" />
      <path d="M14 4l1 2M19 7l2 1M16 11l3-1" />
    </svg>
  ),
  // リターン
  Box: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7l9-4 9 4v10l-9 4-9-4z" />
      <path d="M3 7l9 4 9-4M12 11v10" />
    </svg>
  ),
  Heart: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-7-4.5-9-9.5C1.5 7 5 4 8 5.5c2 1 4 3 4 3s2-2 4-3c3-1.5 6.5 1.5 5 6-2 5-9 9.5-9 9.5z" />
    </svg>
  ),
  Star: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l2.6 6 6.4.6-4.8 4.4 1.4 6.5L12 17l-5.6 3.5 1.4-6.5L3 9.6 9.4 9z" />
    </svg>
  ),
  // 案 B 三角構造用
  Users: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3 3-5 6-5s6 2 6 5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M14 19c1-2 3-3 6-3" />
    </svg>
  ),
  Handshake: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12l4-4 5 4 5-3 4 4-7 6c-1 1-3 1-4 0z" />
    </svg>
  ),
  // 案 C ストーリー用
  Lightbulb: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 17h6M10 21h4" />
      <path d="M7 11a5 5 0 1110 0c0 2.5-2 4-3 5H10c-1-1-3-2.5-3-5z" />
    </svg>
  ),
  HeartHands: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8s-2-3-5-2-3 5 0 7c2 1.5 5 4 5 4s3-2.5 5-4c3-2 3-6 0-7s-5 2-5 2z" />
    </svg>
  ),
  Tools: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4l6 6-3 3-6-6z" />
      <path d="M11 7l-7 7 3 3 7-7" />
      <circle cx="6" cy="18" r="1" />
    </svg>
  ),
  ArrowLoop: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12a8 8 0 0114-5" />
      <path d="M18 4v4h-4" />
      <path d="M20 12a8 8 0 01-14 5" />
      <path d="M6 20v-4h4" />
    </svg>
  ),
};

/* ==========================================================
   案 A — 矢印フロー型
   ========================================================== */
function CycleA({ mobile = false }) {
  return (
    <div className={`cycle-root cycleA ${mobile ? "mobile" : ""}`}>
      <div className="head">
        <span className="section-eyebrow"><span className="dot"></span>循環のしくみ</span>
        <h2>
          スキルが、<span className="em">プロジェクト</span>になり、<br />
          リターンとなって、<span className="em">また誰かへ</span>。
        </h2>
        <p className="lead">
          フィジファンは、お金ではなく <b>スキルと時間</b> で支援する場所。
          支え合いがぐるりと巡り、関係性が現場に残ります。
        </p>
      </div>

      <div className="stage">
        {/* 矢印 SVG（曲線で柔らかく循環を表現） */}
        <svg className="arrow-svg" viewBox="0 0 1100 540" preserveAspectRatio="none">
          <defs>
            <marker id="ah" viewBox="0 0 12 12" refX="6" refY="6" markerWidth="8" markerHeight="8" orient="auto">
              <path d="M1 1 L11 6 L1 11 z" fill="rgba(255,255,255,0.7)" />
            </marker>
          </defs>
          {/* 左 -> 中央 */}
          <path d="M 200 130 Q 380 70, 540 130" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeDasharray="0" markerEnd="url(#ah)" />
          {/* 中央 -> 右 */}
          <path d="M 660 130 Q 820 70, 940 130" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" markerEnd="url(#ah)" />
          {/* 右 -> 下 */}
          <path d="M 940 200 Q 920 380, 660 460" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" markerEnd="url(#ah)" />
          {/* 下 -> 左（戻る） */}
          <path d="M 460 470 Q 220 410, 180 220" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeDasharray="4 6" markerEnd="url(#ah)" />
        </svg>

        {/* 動詞ラベル */}
        <span className="verb" style={{ left: "27%", top: "8%" }}>託す</span>
        <span className="verb" style={{ right: "27%", top: "8%" }}>形にする</span>
        <span className="verb" style={{ right: "10%", bottom: "32%" }}>贈る</span>
        <span className="verb" style={{ left: "16%", bottom: "32%", borderStyle: "dashed" }}>また巡る</span>

        {/* 左ノード: スキル */}
        <div className="node left">
          <div className="ring">
            <div className="core">
              <Icon.Sparkle />
              <span className="lbl">あなたの<br />得意なこと</span>
            </div>
            {/* 衛星 */}
            {[
              { name: "設計", IC: Icon.Hammer, x: -10, y: 22 },
              { name: "農作業", IC: Icon.Sprout, x: 78, y: 8 },
              { name: "料理", IC: Icon.ChefHat, x: 78, y: 96 },
              { name: "デザイン", IC: Icon.Brush, x: -10, y: 110 },
            ].map((s, i) => (
              <div className="sat" key={i} style={{ left: `${s.x}%`, top: `${s.y}%` }}>
                <div className="ic"><s.IC /></div>
                <span className="name">{s.name}</span>
              </div>
            ))}
          </div>
          <div className="title">スキル・時間</div>
          <div className="sub">フィジカル</div>
        </div>

        {/* 中央: フィジファン */}
        <div className="node center">
          <div className="ring">
            <div className="core">
              <img src="references/フィジファン_シンボル_黒.png" alt="フィジファン" />
            </div>
          </div>
          <div className="title">フィジファン</div>
          <div className="sub">人と現場をつなぐ</div>
        </div>

        {/* 右ノード: 目的 */}
        <div className="node right">
          <div className="ring">
            <div className="core">
              <Icon.Flag />
              <span className="lbl">実現したい<br />こと</span>
            </div>
            {[
              { name: "古民家再生", IC: Icon.Home, x: -22, y: 22 },
              { name: "畑づくり", IC: Icon.Wheat, x: 86, y: 8 },
              { name: "イベント", IC: Icon.PartyPopper, x: 86, y: 96 },
              { name: "キャンプ場", IC: Icon.Tent, x: -16, y: 110 },
            ].map((s, i) => (
              <div className="sat" key={i} style={{ left: `${s.x}%`, top: `${s.y}%` }}>
                <div className="ic"><s.IC /></div>
                <span className="name">{s.name}</span>
              </div>
            ))}
          </div>
          <div className="title">プロジェクト</div>
          <div className="sub">リーダーの目的</div>
        </div>

        {/* 下ノード: リターン */}
        <div className="node bottom">
          <div className="ring">
            <div className="core">
              <Icon.Gift />
              <span className="lbl">リターン</span>
            </div>
            {[
              { name: "モノ", IC: Icon.Box, x: -16, y: 60 },
              { name: "コト", IC: Icon.Heart, x: 102, y: 60 },
              { name: "体験", IC: Icon.Star, x: 42, y: 110 },
            ].map((s, i) => (
              <div className="sat" key={i} style={{ left: `${s.x}%`, top: `${s.y}%` }}>
                <div className="ic"><s.IC /></div>
                <span className="name">{s.name}</span>
              </div>
            ))}
          </div>
          <div className="title">モノ・コト・体験</div>
          <div className="sub">サポーターへの贈りもの</div>
        </div>
      </div>

      <p className="footnote">＊金銭は動かない。動くのは「時間」と「ありがとう」だけ。</p>
    </div>
  );
}

/* ==========================================================
   案 B — 三角構造（テラコッタ × 苔）
   ========================================================== */
function CycleB({ mobile = false }) {
  return (
    <div className={`cycle-root cycleB ${mobile ? "mobile" : ""}`}>
      <div className="head">
        <span className="section-eyebrow"><span className="dot"></span>三者の関係性</span>
        <h2>
          <span className="em">リーダー</span>と<span className="em">サポーター</span>を、<br />
          フィジファンが結びます。
        </h2>
        <p className="lead">
          現場を立ち上げる人、現場で動ける人、その間に立つ場所。
          三者の関係性が成立してはじめて、プロジェクトは前に進みます。
        </p>
      </div>

      <div className="triangle">
        {/* 三角形の線 */}
        <svg className="lines" viewBox="0 0 920 600" preserveAspectRatio="none">
          <path d="M 460 110 L 130 510 L 790 510 Z"
            fill="none" stroke="rgba(74, 62, 56, 0.18)" strokeWidth="1.5"
            strokeDasharray="6 8" />
          {/* 矢印（各辺） */}
          <defs>
            <marker id="bah" viewBox="0 0 12 12" refX="6" refY="6" markerWidth="8" markerHeight="8" orient="auto">
              <path d="M1 1 L11 6 L1 11 z" fill="#b8552d" />
            </marker>
            <marker id="bah2" viewBox="0 0 12 12" refX="6" refY="6" markerWidth="8" markerHeight="8" orient="auto">
              <path d="M1 1 L11 6 L1 11 z" fill="#4d5a3a" />
            </marker>
          </defs>
          {/* リーダー -> プラットフォーム */}
          <path d="M 480 180 L 720 470" fill="none" stroke="#b8552d" strokeWidth="1.5" markerEnd="url(#bah)" />
          {/* プラットフォーム -> サポーター */}
          <path d="M 700 510 L 220 510" fill="none" stroke="#4d5a3a" strokeWidth="1.5" markerEnd="url(#bah2)" />
          {/* サポーター -> リーダー */}
          <path d="M 200 470 L 440 180" fill="none" stroke="#b8552d" strokeWidth="1.5" markerEnd="url(#bah)" />
        </svg>

        <div className="vertex leader">
          <div className="card">
            <div className="ic"><Icon.Flag /></div>
            <div className="role">LEADER</div>
            <div className="name">リーダー</div>
            <div className="desc">
              古民家再生・米作り・キャンプ場運営など、現場プロジェクトを立ち上げる人。
            </div>
          </div>
        </div>

        <div className="vertex supporter">
          <div className="card">
            <div className="ic"><Icon.Users /></div>
            <div className="role">SUPPORTER</div>
            <div className="name">サポーター</div>
            <div className="desc">
              スキルや時間で参加し、現場で一緒に汗をかく人。リターンを受け取る。
            </div>
          </div>
        </div>

        <div className="vertex platform">
          <div className="card">
            <div className="ic"><img src="references/フィジファン_シンボル_白.png" alt="" /></div>
            <div className="role">PLATFORM</div>
            <div className="name">フィジファン</div>
            <div className="desc">
              二者をつなぐ場所。公開無料・手数料 0 円・お金は動かない仕組み。
            </div>
          </div>
        </div>

        <span className="edge e1"><span className="verb">①</span>プロジェクトを公開する</span>
        <span className="edge e2"><span className="verb">②</span>仲間が手を挙げる</span>
        <span className="edge e3"><span className="verb">③</span>共に汗をかき、リターンを贈る</span>
      </div>
    </div>
  );
}

/* ==========================================================
   案 C — ストーリーカード型（柿 × 藍）
   ========================================================== */
function CycleC({ mobile = false }) {
  const frames = [
    {
      role: "STEP 01 / 提案",
      title: "「こんな現場、つくりたい」",
      desc: "リーダーが、自分の手で実現したいプロジェクトをフィジファンで公開します。",
      quote: "—— 古民家を、もう一度。",
      ribbon: "提案する",
      Ic: Icon.Lightbulb,
    },
    {
      role: "STEP 02 / 共感",
      title: "「これ、手伝いたいかも」",
      desc: "現場で動けるスキルを持ったサポーターが、想いに共感して手を挙げます。",
      quote: "—— 大工なら、任せて。",
      ribbon: "共感する",
      Ic: Icon.HeartHands,
    },
    {
      role: "STEP 03 / 実行",
      title: "現場で、一緒に汗をかく。",
      desc: "金銭ではなくスキルと時間が動く。同じ場所、同じ時間を共にします。",
      quote: "—— 半年、毎週末。",
      ribbon: "形にする",
      Ic: Icon.Tools,
    },
    {
      role: "STEP 04 / リターン",
      title: "想いはまた、誰かへ。",
      desc: "完成したモノ・コト・体験を、リーダーからサポーターへ。次の現場へ繋がっていく。",
      quote: "—— また、ここに。",
      ribbon: "贈る",
      Ic: Icon.Gift,
    },
  ];

  return (
    <div className={`cycle-root cycleC ${mobile ? "mobile" : ""}`}>
      <div className="head">
        <span className="section-eyebrow"><span className="dot"></span>1 つのプロジェクトの流れ</span>
        <h2>
          一人の<span className="em">「想い」</span>が、<br />
          四つのステップで形になる。
        </h2>
        <p className="lead">
          フィジファンの仕組みを、ひとつのプロジェクトを追いかけながら見てみる。
        </p>
      </div>

      <div className="strip">
        {frames.map((f, i) => (
          <div key={i} className={`frame f${i}`}>
            <div className="num">{String(i + 1).padStart(2, "0")}</div>
            <div className="panel">
              <div className="pic">
                <f.Ic />
                <span className="ribbon">{f.ribbon}</span>
              </div>
              <div className="role">{f.role}</div>
              <div className="title">{f.title}</div>
              <div className="desc">{f.desc}</div>
              <div className="quote">{f.quote}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="loop-back">
        <span className="arrow">
          <Icon.ArrowLoop />
          そして、また次の現場へ
        </span>
      </div>
    </div>
  );
}

window.CycleA = CycleA;
window.CycleB = CycleB;
window.CycleC = CycleC;
