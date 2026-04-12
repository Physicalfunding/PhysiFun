/**
 * ProjectPhase
 *
 * プロジェクトの現在地を示すラベル。
 * 遷移バリデーションなし — リーダーが任意のタイミングで自由に切替可能。
 */
export const ProjectPhase = {
  VISION: "VISION",
  PLANNING: "PLANNING",
  PREPARATION: "PREPARATION",
  EXECUTION: "EXECUTION",
  COMPLETED: "COMPLETED",
} as const;

export type ProjectPhase =
  (typeof ProjectPhase)[keyof typeof ProjectPhase];
