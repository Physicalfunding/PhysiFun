/**
 * 運営アカウントの状態 (#140 / #144)
 *
 * - ACTIVE: ログイン可
 * - DISABLED: 管理 UI から無効化済み (ログイン不可、AdminSession は別途 revoke)
 */
export const AdminAccountStatus = {
  ACTIVE: "ACTIVE",
  DISABLED: "DISABLED",
} as const;

export type AdminAccountStatus = (typeof AdminAccountStatus)[keyof typeof AdminAccountStatus];

export function isAdminAccountStatus(value: string): value is AdminAccountStatus {
  return value === AdminAccountStatus.ACTIVE || value === AdminAccountStatus.DISABLED;
}
