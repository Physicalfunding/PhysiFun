import { HeroSection } from "./HeroSection";
import { CycleSection } from "./CycleSection";
import { CategorySection } from "./CategorySection";
import { PhilosophySection } from "./PhilosophySection";

/**
 * Phase 1: トップページ LP
 *
 * HPデザイン Page 1・2 に基づくランディングページ
 */
export function Phase1LP() {
  return (
    <div className="min-h-screen">
      {/* Page 1: ヒーロー + サービス説明 + 循環図 */}
      <HeroSection />
      <CycleSection />

      {/* Page 2: カテゴリ + プロジェクト事例 + 理念文 */}
      <CategorySection />
      <PhilosophySection />
    </div>
  );
}
