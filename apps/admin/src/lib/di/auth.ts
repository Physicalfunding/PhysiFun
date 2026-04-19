import { BcryptPasswordHasher, PrismaAuthenticateAdapter } from "@physifun/infrastructure";

/**
 * NextAuth authorize 用のアダプタ生成ヘルパー（運営管理アプリ）
 *
 * 認証は UseCase ではないため application 層に Port を置かず、
 * infrastructure 層のクラスを DI 経由で直接利用する。
 */
export function getAuthenticateAdapter() {
  return new PrismaAuthenticateAdapter();
}

export function getBcryptPasswordHasher() {
  return new BcryptPasswordHasher();
}
