import type { ReactElement } from "react";

const Edit = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M16 3l5 5-12 12H4v-5z" />
    <path d="M14 5l5 5" />
  </svg>
);
const Chat = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15a3 3 0 01-3 3H8l-5 4V6a3 3 0 013-3h12a3 3 0 013 3z" />
  </svg>
);
const Megaphone = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 11v2l11 5V6z" />
    <path d="M14 8h3a3 3 0 010 6h-3" />
    <path d="M7 18l1 4h3l-1-4" />
  </svg>
);
const Hands = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 11V5a2 2 0 014 0v6" />
    <path d="M12 11V4a2 2 0 014 0v9" />
    <path d="M16 11V6a2 2 0 014 0v10c0 3-3 6-7 6s-6-2-7-4l-3-6a2 2 0 013-2l2 3" />
  </svg>
);
const ArrowR = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

type Step = {
  n: number;
  dur: string;
  title: string;
  icon: ReactElement;
  desc: string;
  tip: string;
};

const STEPS: Step[] = [
  {
    n: 1,
    dur: "10 分",
    title: "やってみたいことを書く",
    icon: <Edit />,
    desc: "難しい計画書はいりません。「何を、どこで、どんな風に実現したいか」を、自分の言葉でフォームに。下書き保存できます。",
    tip: "完璧じゃなくて大丈夫。まずは話の種です",
  },
  {
    n: 2,
    dur: "1 週間",
    title: "コーディネーターと話す",
    icon: <Chat />,
    desc: "オンラインまたは対面で 30 〜 60 分。やりたいことを一緒に整理して、必要なスキル・時間・場所を見える化していきます。",
    tip: "1 人で抱え込まずに、伴走する人がいます",
  },
  {
    n: 3,
    dur: "2〜4 週間",
    title: "サポーターを募集する",
    icon: <Megaphone />,
    desc: "プロジェクトページを公開して、フィジファンを通じて時間とスキルを募ります。SNS や地域ネットワークと連携して広がっていきます。",
    tip: "人が集まりやすい時期を一緒に考えます",
  },
  {
    n: 4,
    dur: "現場へ",
    title: "プロジェクトを実行する",
    icon: <Hands />,
    desc: "集まった仲間と現場を動かします。事前打ち合わせから当日の段取り、安全管理まで運営がサポート。終わったらリターン（贈り物・記録・関係性）を残します。",
    tip: "現場に残る『関係性』こそが最大のリターン",
  },
];

export function ProcessSection() {
  return (
    <section id="process" className="proc-root">
      <div className="procA">
        <div className="proc-head">
          <span className="eyebrow">
            <span className="dot" aria-hidden="true" />
            はじめかた
          </span>
          <h2>
            書いて、<span className="em">話して</span>、
            <br />
            集めて、<span className="em">動かす</span>。
          </h2>
          <p className="lead">
            リーダーになるのに、特別な資格はいりません。 小さな「やってみたい」を、4
            ステップで現場まで運びます。
          </p>
        </div>

        <div className="steps">
          <div className="spine" aria-hidden="true" />
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
            <b>30 分の無料相談から</b>はじめられます。
            <br />
            オンライン / 対面、どちらでも。
          </div>
          <a href="#consult">
            無料相談を申し込む <ArrowR />
          </a>
        </div>
      </div>
    </section>
  );
}
