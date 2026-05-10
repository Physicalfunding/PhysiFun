/* global React */

const VIcon = {
  Arrow: () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
};

const VOICES = [
  {
    initials: "MK", color: "#c62828",
    name: "三輪 啓介", role: "DIY・建築 / 長野・松本",
    project: "古民家の土壁を、3 日で塗り直したい",
    cat: "DIY・建築", place: "NAGANO",
    bg: "linear-gradient(160deg, #f3d3c3 0%, #c97a55 50%, #6c2f1a 100%)",
    label: "WALL / DOZO",
    quote: "「ぜんぶ自分で抱えなきゃ」と思っていた。ふたを開けたら、知らない誰かが鏝を握ってくれていた。",
    body: "雨漏りで傷んだ土壁を、左官職人と地域の人で塗り直しました。寝食を共にした 3 日間で、家族だけだった我が家が、地域の家になった気がしています。",
    pull: "知らない誰かが、鏝を握ってくれていた。",
  },
  {
    initials: "FS", color: "#a05536",
    name: "島袋 文代", role: "料理・食 / 鹿児島・与論",
    project: "島の郷土料理を、1 冊にまとめたい",
    cat: "料理・食", place: "KAGOSHIMA",
    bg: "linear-gradient(160deg, #f4dba0 0%, #c98842 50%, #6e4920 100%)",
    label: "RECIPE",
    quote: "私が言葉にできなかった『願い』を、ちゃんと拾ってくれた。それだけで前に進めた。",
    body: "おばあたちのレシピを記録する仕事は、私一人では絶対に終わらなかった。書き手・撮影・編集、それぞれの得意で集まってくれた仲間に救われました。",
    pull: "言葉にできなかった願いを、拾ってくれた。",
  },
  {
    initials: "HF", color: "#5a6f3a",
    name: "藤本 はる", role: "農・自然 / 岡山・西粟倉",
    project: "棚田を再生して、米を作る",
    cat: "農・自然", place: "OKAYAMA",
    bg: "linear-gradient(160deg, #c5d6a4 0%, #5a6f3a 50%, #2a3520 100%)",
    label: "TANADA",
    quote: "終わったあとも、サポーターと連絡を取り合っている。プロジェクトより長く、関係性が残った。",
    body: "10 年放置されていた田んぼを、22 人の仲間と再生しました。畔の補修、草刈り、田植え。一番嬉しかったのは、終わってからも続いている連絡です。",
    pull: "プロジェクトより、関係性が長く残った。",
  },
];

const STATS = [
  { num: "182", unit: "人", label: "これまでに動いた\nリーダーの数" },
  { num: "94", unit: "%", label: "「またやりたい」と\n答えたリーダー" },
  { num: "2,840", unit: "h", label: "サポーターから\n寄せられた時間" },
];

function VoiceHead() {
  return (
    <div className="voice-head">
      <span className="eyebrow"><span className="dot"></span>リーダーの声</span>
      <h2>
        やってみて、<br />
        <span className="em">なにが残ったか</span>。
      </h2>
      <p className="lead">
        実際にプロジェクトを立ち上げた人たちに、終わったあとの「いま」を聞きました。
      </p>
    </div>
  );
}

function Avatar({ v, size = 56 }) {
  return (
    <span
      className="avatar"
      style={{
        width: size, height: size,
        background: v.color,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontFamily: "Geist, sans-serif",
        fontWeight: 700, fontSize: size * 0.32,
        letterSpacing: "0.02em",
      }}
    >
      {v.initials}
    </span>
  );
}

/* ==========================================================
   案 A — 引用フォーカス型
   ========================================================== */
function VoiceA({ mobile = false }) {
  return (
    <div className={`voice-root voiceA ${mobile ? "mobile" : ""}`}>
      <VoiceHead />
      <div className="grid">
        {VOICES.map((v) => (
          <article key={v.initials} className="card">
            <span className="quote-mark">&ldquo;</span>
            <p className="quote">{v.quote}</p>
            <div className="tags">
              <span>{v.cat}</span>
              <span>{v.role.split(" / ")[1]}</span>
            </div>
            <div className="body">
              <Avatar v={v} size={56} />
              <div className="who">
                <span className="name">{v.name} さん</span>
                <span className="meta">{v.project}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

/* ==========================================================
   案 B — 雑誌インタビュー型
   ========================================================== */
function VoiceB({ mobile = false }) {
  const [main, ...rest] = VOICES;
  return (
    <div className={`voice-root voiceB ${mobile ? "mobile" : ""}`}>
      <VoiceHead />
      <div className="grid">
        <article className="feature">
          <div className="pic v-ph" data-label={main.label} style={{ background: main.bg }}>
            <span className="issue">VOICE / 01 ・ {main.place}</span>
            <div className="pull-quote">「{main.pull}」</div>
          </div>
          <div className="body">
            <div className="meta-row">
              <Avatar v={main} size={44} />
              <div className="who-block">
                <span className="name">{main.name} さん</span>
                <span className="role">{main.role}</span>
              </div>
            </div>
            <h3>{main.project}</h3>
            <p>{main.body}</p>
            <span className="read-more">インタビュー全文を読む <VIcon.Arrow /></span>
          </div>
        </article>
        <div className="side">
          {rest.map((v, i) => (
            <article key={v.initials} className="small">
              <div className="num">VOICE / 0{i + 2}</div>
              <div className="quote">「{v.pull}」</div>
              <div className="who-row">
                <Avatar v={v} size={36} />
                <div>
                  <div className="name">{v.name} さん</div>
                  <div className="role">{v.role}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="more-link">
        <a href="#voices">すべてのリーダーの声を見る <VIcon.Arrow /></a>
      </div>
    </div>
  );
}

/* ==========================================================
   案 C — 数字 + 言葉カード型
   ========================================================== */
function VoiceC({ mobile = false }) {
  return (
    <div className={`voice-root voiceC ${mobile ? "mobile" : ""}`}>
      <VoiceHead />
      <div className="stats">
        {STATS.map((s, i) => (
          <div key={i} className="stat-card">
            <div className="num">{s.num}<span className="unit">{s.unit}</span></div>
            <div className="label">{s.label.split("\n").map((l, j) => <span key={j} style={{ display: "block" }}>{l}</span>)}</div>
          </div>
        ))}
      </div>
      <div className="grid">
        {VOICES.map((v) => (
          <article key={v.initials} className="card">
            <div className="pic v-ph" data-label={v.label} style={{ background: v.bg }}>
              <span className="cat">{v.cat}</span>
              <span className="place">{v.place}</span>
            </div>
            <div className="body">
              <p className="quote">{v.quote}</p>
              <div className="role-line">
                <Avatar v={v} size={40} />
                <div>
                  <div className="name">{v.name} さん</div>
                  <div className="meta">{v.role.split(" / ")[1]}</div>
                </div>
                <span className="read">READ →</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { VoiceA, VoiceB, VoiceC });
