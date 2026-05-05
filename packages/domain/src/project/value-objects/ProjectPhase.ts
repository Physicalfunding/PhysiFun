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
 * `ProjectPhase` の妥当な値かどうかを判定する型ガード
 *
 * Prisma 等の外部由来 `string` 値を `ProjectPhase` として安全に絞り込むのに使用する。
 *
 * `ProjectPhase` 定数を直接参照することで、値追加時の同期忘れを防ぐ。
 */
export function isProjectPhase(value: string): value is ProjectPhase {
  return (Object.values(ProjectPhase) as string[]).includes(value);
}
