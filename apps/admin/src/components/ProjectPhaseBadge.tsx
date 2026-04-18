import type { ProjectPhase } from "@physifun/domain";

const BADGE_STYLES: Record<ProjectPhase, string> = {
  VISION: "border-slate-300 text-slate-700",
  PLANNING: "border-blue-300 text-blue-700",
  PREPARATION: "border-indigo-300 text-indigo-700",
  EXECUTION: "border-amber-300 text-amber-700",
  COMPLETED: "border-emerald-300 text-emerald-700",
};

const BADGE_LABELS: Record<ProjectPhase, string> = {
  VISION: "構想",
  PLANNING: "計画",
  PREPARATION: "準備",
  EXECUTION: "実行",
  COMPLETED: "完了",
};

/**
 * ProjectPhase バッジ (VISION / PLANNING / PREPARATION / EXECUTION / COMPLETED)
 *
 * 公開ステータスほど主張しないよう outline 系の控えめなスタイル。
 */
export function ProjectPhaseBadge({ phase }: { phase: ProjectPhase }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border bg-white px-2.5 py-0.5 text-xs font-medium ${BADGE_STYLES[phase]}`}
    >
      {BADGE_LABELS[phase]}
    </span>
  );
}
