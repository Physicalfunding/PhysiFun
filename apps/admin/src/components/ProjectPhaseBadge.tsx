import type { ProjectPhase } from "@physifun/domain";
import { PROJECT_PHASE_LABELS } from "@physifun/domain";

const BADGE_STYLES: Record<ProjectPhase, string> = {
  VISION: "border-slate-300 text-slate-700",
  PLANNING: "border-blue-300 text-blue-700",
  READY: "border-indigo-300 text-indigo-700",
  EXECUTION: "border-amber-300 text-amber-700",
  ONGOING: "border-emerald-300 text-emerald-700",
};

/**
 * ProjectPhase バッジ (VISION / PLANNING / READY / EXECUTION / ONGOING)
 *
 * 公開ステータスほど主張しないよう outline 系の控えめなスタイル。
 * ラベルは domain の PROJECT_PHASE_LABELS を参照（必ず日本語ラベル経由）。
 */
export function ProjectPhaseBadge({ phase }: { phase: ProjectPhase }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border bg-white px-2.5 py-0.5 text-xs font-medium ${BADGE_STYLES[phase]}`}
    >
      {PROJECT_PHASE_LABELS[phase]}
    </span>
  );
}
