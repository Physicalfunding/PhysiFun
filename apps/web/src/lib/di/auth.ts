import { BcryptPasswordHasher } from "@physifun/infrastructure";
import { KyselyAuthenticateAdapter } from "@physifun/infrastructure/src/kysely";

/**
 * NextAuth authorize 用のアダプタ生成ヘルパー（#223 で Kysely 実装へ移行）
 *
 * 認証は UseCase ではないため application 層に Port を置かず、
 * infrastructure 層のクラスを DI 経由で直接利用する。
 */
export function getAuthenticateAdapter() {
  return new KyselyAuthenticateAdapter();
}

export function getBcryptPasswordHasher() {
  return new BcryptPasswordHasher();
}
