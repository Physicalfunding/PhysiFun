/**
 * 理念文セクション
 *
 * PDFデザイン Page 2 下部の「フィジファンを応援してくれる皆様へ」テキスト
 */
export function PhilosophySection() {
  return (
    <section className="bg-gray-50 py-16 sm:py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* セクションタイトル */}
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-center text-gray-900 mb-4">
          フィジファンを応援してくれる皆様へ。
        </h2>

        {/* 赤いアクセントライン */}
        <div className="w-16 h-1 bg-physifun-red mx-auto mb-10" />

        {/* サブタイトル */}
        <p className="text-center text-lg sm:text-xl font-bold text-gray-800 mb-10">
          「完成品」よりも、共に汗をかいた「時間」を贈りたい。
        </p>

        {/* 本文 */}
        <div className="space-y-6 text-gray-700 text-sm sm:text-base leading-relaxed">
          <p>
            モノがあふれる現代において、私たちが本当に心から求めているのは、
            手軽に手に入る完成品ではなく、それが生まれるまでの「物語」ではないでしょうか。
          </p>

          <p>
            金銭的な支援や遠くからの応援だけでは決して味わえない、ものづくりの真の醍醐味。
            それは、同じ現場に立ち、同じ時間と空間、そして試行錯誤という行動を共にすることにあります。
          </p>

          <p>
            一人の「創りたい」という情熱に、誰かの「スキル」が重なり、共に手を動かして形になる。
            その過程で生まれる濃密な繋がりこそが、真の価値だと私たちは信じています。
          </p>

          <p>
            手伝った記憶としてのリターンは、単なる報酬ではなく、その場所やそこに再び帰りたくなる「絆」の印。
            制作過程を通じて、人と人とが深く、より価値ある形で結ばれる未来を、ここから始めます。
          </p>
        </div>
      </div>
    </section>
  );
}
