import { LpHeader } from "./LpHeader";
import { HeroSection } from "./HeroSection";
import { CycleSection } from "./CycleSection";
import { CategorySection } from "./CategorySection";
import { ProcessSection } from "./ProcessSection";
import { VoiceSection } from "./VoiceSection";
import { SupportSection } from "./SupportSection";
import { CtaFooterSection } from "./CtaFooterSection";
import "./lp.css";

/**
 * Phase 1: トップページ LP（7 セクション構成）
 * 設計参照: apps/web/public/design_handoff_top_lp/
 */
export function Phase1LP() {
  return (
    <>
      <LpHeader />
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
