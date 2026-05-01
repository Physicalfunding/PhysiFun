import { ProjectPhase } from "./ProjectPhase";

/**
 * ProjectPhase の日本語ラベル
 *
 * バックエンド内部では英語 enum 値（ProjectPhase）を扱い、
 * フロント表示は必ずこのラベル経由で行う。
 *
 * 詳細は Issue #192「ProjectPhase enum リネーム」参照。
 */
export const PROJECT_PHASE_LABELS: Record<ProjectPhase, string> = {
  [ProjectPhase.VISION]: "構想段階",
  [ProjectPhase.PLANNING]: "準備中（企画・調整中）",
  [ProjectPhase.READY]: "実行直前（準備ほぼ完了）",
  [ProjectPhase.EXECUTION]: "実行中",
  [ProjectPhase.ONGOING]: "一部完了（継続中）",
};
