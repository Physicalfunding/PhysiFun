type Voice = {
  initials: string;
  color: string;
  name: string;
  role: string;
  cat: string;
  place: string;
  bg: string;
  label: string;
  quote: string;
};

const VOICES: Voice[] = [
  {
    initials: "MK",
    color: "#c62828",
    name: "三輪 啓介",
    role: "DIY・建築 / 長野・松本",
    cat: "DIY・建築",
    place: "NAGANO",
    bg: "linear-gradient(160deg, #f3d3c3 0%, #c97a55 50%, #6c2f1a 100%)",
    label: "WALL / DOZO",
    quote:
      "「ぜんぶ自分で抱えなきゃ」と思っていた。ふたを開けたら、知らない誰かが鏝を握ってくれていた。",
  },
  {
    initials: "FS",
    color: "#a05536",
    name: "島袋 文代",
    role: "料理・食 / 鹿児島・与論",
    cat: "料理・食",
    place: "KAGOSHIMA",
    bg: "linear-gradient(160deg, #f4dba0 0%, #c98842 50%, #6e4920 100%)",
    label: "RECIPE",
    quote: "私が言葉にできなかった『願い』を、ちゃんと拾ってくれた。それだけで前に進めた。",
  },
  {
    initials: "HF",
    color: "#5a6f3a",
    name: "藤本 はる",
    role: "農・自然 / 岡山・西粟倉",
    cat: "農・自然",
    place: "OKAYAMA",
    bg: "linear-gradient(160deg, #c5d6a4 0%, #5a6f3a 50%, #2a3520 100%)",
    label: "TANADA",
    quote:
      "終わったあとも、サポーターと連絡を取り合っている。プロジェクトより長く、関係性が残った。",
  },
];

const STATS: { num: string; unit: string; label: string[] }[] = [
  { num: "182", unit: "人", label: ["これまでに動いた", "リーダーの数"] },
  { num: "94", unit: "%", label: ["「またやりたい」と", "答えたリーダー"] },
  { num: "2,840", unit: "h", label: ["サポーターから", "寄せられた時間"] },
];

function VoiceAvatar({ v, size = 40 }: { v: Voice; size?: number }) {
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        background: v.color,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontFamily: "var(--font-en)",
        fontWeight: 700,
        fontSize: size * 0.32,
        letterSpacing: "0.02em",
      }}
    >
      {v.initials}
    </span>
  );
}

export function VoiceSection() {
  return (
    <section id="voice" className="voice-root">
      <div className="voiceC">
        <div className="voice-head">
          <span className="eyebrow">
            <span className="dot" aria-hidden="true" />
            リーダーの声
          </span>
          <h2>
            やってみて、
            <br />
            <span className="em">なにが残ったか</span>。
          </h2>
          <p className="lead">
            実際にプロジェクトを立ち上げた人たちに、終わったあとの「いま」を聞きました。
          </p>
        </div>

        <div className="stats">
          {STATS.map((s, i) => (
            <div key={i} className="stat-card">
              <div className="num">
                {s.num}
                <span className="unit">{s.unit}</span>
              </div>
              <div className="label">
                {s.label.map((l, j) => (
                  <span key={j} style={{ display: "block" }}>
                    {l}
                  </span>
                ))}
              </div>
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
                  <VoiceAvatar v={v} size={40} />
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
    </section>
  );
}
