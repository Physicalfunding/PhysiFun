import { BcryptPasswordHasher, PrismaAdminAuthenticateAdapter } from "@physifun/infrastructure";

/**
 * NextAuth authorize 用のアダプタ生成ヘルパー（運営管理アプリ）
 *
 * Phase 2 (#144) で Account → AdminAccount に切替済み。
 * 認証は UseCase ではないため application 層に Port を置かず、
 * infrastructure 層のクラスを DI 経由で直接利用する。
 */
export function getAdminAuthenticateAdapter() {
  return new PrismaAdminAuthenticateAdapter();
}

export function getBcryptPasswordHasher() {
  return new BcryptPasswordHasher();
}
