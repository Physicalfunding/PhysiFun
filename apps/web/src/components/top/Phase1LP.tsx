import { HeroSection } from "./HeroSection";
import { CycleSection } from "./CycleSection";
import { CategorySection } from "./CategorySection";
import { ProcessSection } from "./ProcessSection";
import { VoiceSection } from "./VoiceSection";
import { SupportSection } from "./SupportSection";
import { CtaFooterSection } from "./CtaFooterSection";

/**
 * Phase 1: トップページ LP（7 セクション構成）
 * Hero=B / Cycle=A / Category=A / Process=A / Voice=C / Support=A / CTA=A
 * ヘッダーは layout.tsx でグローバル描画する LpHeader を共通利用する。
 */
export function Phase1LP() {
  return (
    <>
      <HeroSection />
      <CycleSection />
      <CategorySection />
      <ProcessSection />
      <VoiceSection />
      <SupportSection />
      <CtaFooterSection />
    </>
  );
}
