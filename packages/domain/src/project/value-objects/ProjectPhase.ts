/**
 * ProjectPhase
 *
 * プロジェクトの現在地を示すラベル。
 * 遷移バリデーションなし — リーダーが任意のタイミングで自由に切替可能。
 */
export const ProjectPhase = {
  VISION: "VISION",
  PLANNING: "PLANNING",
  READY: "READY",
  EXECUTION: "EXECUTION",
  ONGOING: "ONGOING",
} as const;

export type ProjectPhase = (typeof ProjectPhase)[keyof typeof ProjectPhase];

/**
 * `ProjectPhase` の値配列（Zod `z.enum(...)` 用）
 *
 * フロント / アプリケーション層 双方の入力スキーマで Single Source of Truth として
 * 利用する。
 */
export const PROJECT_PHASE_VALUES = Object.values(ProjectPhase) as [
  ProjectPhase,
  ...ProjectPhase[],
];
