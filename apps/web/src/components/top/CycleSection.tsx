import Image from "next/image";
import type { ReactElement } from "react";

const Sparkle = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    <circle cx="12" cy="12" r="3.4" />
  </svg>
);
const Flag = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 4v17" />
    <path d="M5 5c4-2 7 2 11 0v9c-4 2-7-2-11 0" />
  </svg>
);
const Gift = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="9" width="18" height="11" rx="1.5" />
    <path d="M3 13h18M12 9v11" />
    <path d="M8 9c-1.5-3 1-5 4-2 3-3 5.5-1 4 2" />
  </svg>
);
const Hammer = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 4l6 6-3 3-6-6z" />
    <path d="M11 7l-7 7 3 3 7-7" />
    <path d="M5 16l-2 5 5-2" />
  </svg>
);
const Sprout = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21V11" />
    <path d="M8 9c0-3 4-4 4 0 0-4 4-3 4 0 0 3-4 5-4 5s-4-2-4-5z" />
    <path d="M5 14c-2 0-3-2-3-4 2 0 4 1 4 4z" />
  </svg>
);
const ChefHat = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 14c-2 0-3-1.5-3-3.5C3 8 5 7 7 7c0-3 8-3 8 0 2 0 4 1 4 3.5 0 2-1 3.5-3 3.5" />
    <path d="M6 14h12v5a1 1 0 01-1 1H7a1 1 0 01-1-1z" />
  </svg>
);
const Brush = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 3l5 5-9 9H7v-5z" />
    <path d="M7 17l-3 4 4-3" />
  </svg>
);
const Home = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z" />
  </svg>
);
const Tent = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21l9-15 9 15" />
    <path d="M12 6v15M9 21l3-5 3 5" />
  </svg>
);
const Wheat = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21V8" />
    <path d="M12 12c-3-1-4-3-3-6 3 1 4 3 3 6zM12 12c3-1 4-3 3-6-3 1-4 3-3 6zM12 8c-3-1-4-3-3-6 3 1 4 3 3 6zM12 8c3-1 4-3 3-6-3 1-4 3-3 6z" />
  </svg>
);
const PartyPopper = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 22l5-14 9 9z" />
    <path d="M14 4l1 2M19 7l2 1M16 11l3-1" />
  </svg>
);
const Box = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7l9-4 9 4v10l-9 4-9-4z" />
    <path d="M3 7l9 4 9-4M12 11v10" />
  </svg>
);
const Heart = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21s-7-4.5-9-9.5C1.5 7 5 4 8 5.5c2 1 4 3 4 3s2-2 4-3c3-1.5 6.5 1.5 5 6-2 5-9 9.5-9 9.5z" />
  </svg>
);
const Star = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l2.6 6 6.4.6-4.8 4.4 1.4 6.5L12 17l-5.6 3.5 1.4-6.5L3 9.6 9.4 9z" />
  </svg>
);

type Sat = { name: string; Ic: () => ReactElement; x: number; y: number };

// 中心アイコンを囲む配置（リング 168px に対する % 指定、半径 62%）
// 4 個ノード: NW / NE / SE / SW（45° 対角）
// 3 個ノード: 上 / 右下 / 左下（正三角形 120°）
const skillSats: Sat[] = [
  { name: "設計", Ic: Hammer, x: -11, y: -12 },
  { name: "農作業", Ic: Sprout, x: 77, y: -12 },
  { name: "料理", Ic: ChefHat, x: 77, y: 76 },
  { name: "デザイン", Ic: Brush, x: -11, y: 76 },
];

const goalSats: Sat[] = [
  { name: "古民家再生", Ic: Home, x: -11, y: -12 },
  { name: "畑づくり", Ic: Wheat, x: 77, y: -12 },
  { name: "イベント", Ic: PartyPopper, x: 77, y: 76 },
  { name: "キャンプ場", Ic: Tent, x: -11, y: 76 },
];

const returnSats: Sat[] = [
  { name: "モノ", Ic: Box, x: 33, y: -30 },
  { name: "コト", Ic: Heart, x: 87, y: 63 },
  { name: "体験", Ic: Star, x: -21, y: 63 },
];

function Satellites({ sats }: { sats: Sat[] }) {
  return (
    <>
      {sats.map((s) => (
        <div key={s.name} className="sat" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
          <div className="ic">
            <s.Ic />
          </div>
          <span className="name">{s.name}</span>
        </div>
      ))}
    </>
  );
}

export function CycleSection() {
  return (
    <section id="cycle" className="cycle-root">
      <div className="cycleA">
        <div className="head">
          <span className="section-eyebrow">
            <span className="dot" aria-hidden="true" />
            循環のしくみ
          </span>
          <h2>
            スキルが、<span className="em">プロジェクト</span>になり、
            <br />
            リターンとなって、<span className="em">また誰かへ</span>。
          </h2>
          <p className="lead">
            フィジファンは、お金ではなく <b>スキルと時間</b> で支援する場所。
            支え合いがぐるりと巡り、関係性が現場に残ります。
          </p>
        </div>

        <div className="stage">
          <svg className="arrow-svg" viewBox="0 0 1100 540" preserveAspectRatio="none">
            <defs>
              <marker
                id="cycle-arrow"
                viewBox="0 0 12 12"
                refX="6"
                refY="6"
                markerWidth="8"
                markerHeight="8"
                orient="auto"
              >
                <path d="M1 1 L11 6 L1 11 z" fill="rgba(255,255,255,0.7)" />
              </marker>
            </defs>
            {/* 左 → 中央: 左コア東端 (186,127) → 中央コア西端 (484,146) */}
            <path
              d="M 186 127 Q 335 90 484 146"
              fill="none"
              stroke="rgba(255,255,255,0.45)"
              strokeWidth="2"
              markerEnd="url(#cycle-arrow)"
            />
            {/* 中央 → 右: 中央コア東端 (616,146) → 右コア西端 (914,127) */}
            <path
              d="M 616 146 Q 765 90 914 127"
              fill="none"
              stroke="rgba(255,255,255,0.45)"
              strokeWidth="2"
              markerEnd="url(#cycle-arrow)"
            />
            {/* 右 → 下: 右コア南西端 (931,168) → 下コア北東端 (591,385)。SE側に大きく膨らむ円弧 */}
            <path
              d="M 931 168 Q 1020 400 591 385"
              fill="none"
              stroke="rgba(255,255,255,0.45)"
              strokeWidth="2"
              markerEnd="url(#cycle-arrow)"
            />
            {/* 下 → 左 (戻り): 下コア北西端 (509,385) → 左コア南東端 (169,168)。SW側に大きく膨らむ円弧 */}
            <path
              d="M 509 385 Q 80 400 169 168"
              fill="none"
              stroke="rgba(255,255,255,0.45)"
              strokeWidth="2"
              strokeDasharray="4 6"
              markerEnd="url(#cycle-arrow)"
            />
          </svg>

          <span className="verb" style={{ left: "27%", top: "8%" }}>
            託す
          </span>
          <span className="verb" style={{ right: "27%", top: "8%" }}>
            形にする
          </span>
          <span className="verb" style={{ right: "10%", bottom: "32%" }}>
            贈る
          </span>
          <span
            className="verb"
            style={{ left: "16%", bottom: "32%", borderStyle: "dashed" }}
          >
            また巡る
          </span>

          <div className="node left">
            <div className="node-ring">
              <div className="core">
                <Sparkle />
                <span className="lbl">
                  あなたの
                  <br />
                  得意なこと
                </span>
              </div>
              <Satellites sats={skillSats} />
            </div>
            <div className="title">スキル・時間</div>
            <div className="sub">フィジカル</div>
          </div>

          <div className="node center">
            <div className="title">フィジファン</div>
            <div className="sub">人と現場をつなぐ</div>
            <div className="node-ring">
              <div className="core">
                <Image
                  src="/images/symbol-black.png"
                  alt="フィジファン"
                  width={132}
                  height={132}
                />
              </div>
            </div>
          </div>

          <div className="node right">
            <div className="node-ring">
              <div className="core">
                <Flag />
                <span className="lbl">
                  実現したい
                  <br />
                  こと
                </span>
              </div>
              <Satellites sats={goalSats} />
            </div>
            <div className="title">プロジェクト</div>
            <div className="sub">リーダーの目的</div>
          </div>

          <div className="node bottom">
            <div className="node-ring">
              <div className="core">
                <Gift />
                <span className="lbl">リターン</span>
              </div>
              <Satellites sats={returnSats} />
            </div>
            <div className="title">モノ・コト・体験</div>
            <div className="sub">サポーターへの贈りもの</div>
          </div>
        </div>

        <p className="footnote">
          ＊金銭は動かない。動くのは「時間」と「ありがとう」だけ。
        </p>
      </div>
    </section>
  );
}
