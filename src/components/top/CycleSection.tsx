import Image from "next/image";

/**
 * 循環図セクション
 *
 * 左: 「あなたの得意なこと」クラスター（周囲に具体例アイコン）
 * 中央: フィジファンシンボル
 * 右: 「実現したいこと・あなたの目的」クラスター（周囲に具体例アイコン）
 * 下: リターン
 */

const skillIcons = [
  { label: "設計・デザイン", icon: "🏗️" },
  { label: "農作業", icon: "🌾" },
  { label: "料理", icon: "🍳" },
  { label: "体験", icon: "🎁" },
];

const goalIcons = [
  { label: "古民家再生", icon: "🏠" },
  { label: "畑づくり", icon: "🌱" },
  { label: "イベント開催", icon: "🎪" },
  { label: "キャンプ場", icon: "⛺" },
];

const returnIcons = [
  { label: "モノ", icon: "📦" },
  { label: "コト", icon: "✨" },
  { label: "体験", icon: "🎉" },
];

/** 中心の周りにアイコンを円形配置するクラスター */
function IconCluster({
  label,
  items,
  icon,
}: {
  label: string;
  items: { label: string; icon: string }[];
  icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center">
      {/* 周囲アイコン + 中央ラベル */}
      <div className="relative w-52 h-52 sm:w-60 sm:h-60">
        {/* 中央 */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
            {icon}
          </div>
          <span className="mt-2 text-white text-xs sm:text-sm font-bold text-center whitespace-pre-line leading-tight">
            {label}
          </span>
        </div>

        {/* 周囲アイコン */}
        {items.map((item, i) => {
          const angle = (360 / items.length) * i - 90;
          const radius = 80;
          const rad = (angle * Math.PI) / 180;
          const x = 50 + (radius / 120) * 50 * Math.cos(rad);
          const y = 50 + (radius / 120) * 50 * Math.sin(rad);
          return (
            <div
              key={item.label}
              className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center text-xl">
                {item.icon}
              </div>
              <span className="mt-0.5 text-[9px] sm:text-[10px] text-white/80 whitespace-nowrap">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CycleSection() {
  return (
    <section className="bg-physifun-red py-16 sm:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* デスクトップ: 横並び */}
        <div className="hidden md:flex items-center justify-center gap-4 lg:gap-8">
          {/* 左: あなたの得意なこと */}
          <IconCluster
            label={"あなたの\n得意なこと"}
            items={skillIcons}
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                className="w-8 h-8 text-white"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                />
              </svg>
            }
          />

          {/* 中央: フィジファンシンボル */}
          <div className="flex flex-col items-center">
            <div className="bg-white rounded-3xl p-5">
              <Image
                src="/images/symbol-black.png"
                alt="フィジファン"
                width={100}
                height={100}
                className="w-24 h-24"
              />
            </div>
            <span className="mt-3 text-white text-lg font-bold">フィジカル</span>
            <span className="text-xs text-white/70">（スキル・時間）</span>
          </div>

          {/* 右: 実現したいこと */}
          <IconCluster
            label={"実現したいこと\nあなたの目的"}
            items={goalIcons}
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                className="w-8 h-8 text-white"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5"
                />
              </svg>
            }
          />
        </div>

        {/* リターン（デスクトップ） */}
        <div className="hidden md:flex flex-col items-center mt-10">
          <div className="flex items-center gap-6">
            {returnIcons.map((item) => (
              <div key={item.label} className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center text-xl">
                  {item.icon}
                </div>
                <span className="mt-1 text-[10px] text-white/80">{item.label}</span>
              </div>
            ))}
          </div>
          <span className="mt-3 text-white text-sm font-bold">リターン</span>
          <span className="text-xs text-white/70">（モノ / コト / 体験）</span>
        </div>

        {/* モバイル: 縦並び */}
        <div className="md:hidden space-y-8">
          {/* あなたの得意なこと */}
          <div className="flex flex-col items-center">
            <IconCluster
              label={"あなたの\n得意なこと"}
              items={skillIcons}
              icon={
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  className="w-8 h-8 text-white"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                  />
                </svg>
              }
            />
          </div>

          {/* フィジファンシンボル */}
          <div className="flex flex-col items-center">
            <div className="bg-white rounded-3xl p-5">
              <Image
                src="/images/symbol-black.png"
                alt="フィジファン"
                width={80}
                height={80}
                className="w-20 h-20"
              />
            </div>
            <span className="mt-2 text-white text-base font-bold">フィジカル</span>
            <span className="text-xs text-white/70">（スキル・時間）</span>
          </div>

          {/* 実現したいこと */}
          <div className="flex flex-col items-center">
            <IconCluster
              label={"実現したいこと\nあなたの目的"}
              items={goalIcons}
              icon={
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  className="w-8 h-8 text-white"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5"
                  />
                </svg>
              }
            />
          </div>

          {/* リターン */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-4">
              {returnIcons.map((item) => (
                <div key={item.label} className="flex flex-col items-center">
                  <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center text-lg">
                    {item.icon}
                  </div>
                  <span className="mt-1 text-[10px] text-white/80">{item.label}</span>
                </div>
              ))}
            </div>
            <span className="mt-2 text-white text-sm font-bold">リターン</span>
            <span className="text-xs text-white/70">（モノ / コト / 体験）</span>
          </div>
        </div>
      </div>
    </section>
  );
}
