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

const PROJECT_PHASE_VALUES = new Set<string>(Object.values(ProjectPhase));

/**
 * 任意の文字列が ProjectPhase の値かどうか判定する型ガード。
 * 永続化層（Prisma 行）からの復元時に使用する。
 */
export function isProjectPhase(value: unknown): value is ProjectPhase {
  return typeof value === "string" && PROJECT_PHASE_VALUES.has(value);
}
