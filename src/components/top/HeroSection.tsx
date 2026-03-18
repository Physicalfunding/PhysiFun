import Link from "next/link";

/**
 * ヒーローセクション
 *
 * 背景動画 → その下にキャッチコピー + CTA
 */
export function HeroSection() {
  return (
    <>
      {/* 動画セクション */}
      <section className="relative w-full h-[70vh] sm:h-[80vh] overflow-hidden">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/videos/hero.mp4" type="video/mp4" />
        </video>
      </section>

      {/* テキスト + CTAセクション */}
      <section className="bg-physifun-red py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* キャッチコピー */}
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white leading-tight tracking-wide">
            あなたの「好き」が、
            <br />
            誰かの「助け」になる。
            <br />
            最高のフィジファン体験を。
          </h1>

          {/* 説明文 */}
          <p className="mt-8 text-sm sm:text-base md:text-lg text-white/90 max-w-3xl mx-auto leading-relaxed">
            誰でもジャンルを問わず、【起案者（リーダー）】として、
            <br className="hidden sm:block" />
            プロジェクト（こんなことをやってみたい）を提案でき、
            <br className="hidden sm:block" />
            その想いに共感した方は【支援者（サポーター）】として、
            <br className="hidden sm:block" />
            【スキル・時間（＝フィジカル）】で支援できる{" "}
            <span className="font-bold">&ldquo;現場共創&rdquo;</span> サービスです。
          </p>

          {/* サービス名の由来 */}
          <p className="mt-6 text-xs sm:text-sm text-white/70 tracking-wider">
            フィジカル（Physical）＋クラウドファンディング（Crowdfunding）
          </p>

          {/* CTA */}
          <div className="mt-10">
            <Link
              href="/apply"
              className="inline-flex items-center rounded-full bg-white px-8 py-4 text-lg font-bold text-physifun-red shadow-lg hover:bg-gray-100 transition-colors"
            >
              プロジェクトをつくってみる
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
