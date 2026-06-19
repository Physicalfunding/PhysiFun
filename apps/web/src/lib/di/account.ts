import { BcryptPasswordHasher } from "@physifun/infrastructure";
import { KyselyActivateAccountAdapter } from "@physifun/infrastructure/src/kysely";
import type { ActivateAccountPort, PasswordHasher } from "@physifun/application";

/**
 * ActivateAccountUseCase 用のポート生成ヘルパー（#223 で Kysely 実装へ移行）
 *
 * infrastructure の Kysely アダプタを ActivateAccountPort インターフェースに
 * 適合させる。アダプタは stateless なので DI 関数ごとに独自インスタンス化する。
 */
export function getActivateAccountPort(): ActivateAccountPort {
  return new KyselyActivateAccountAdapter();
}

/**
 * PasswordHasher（bcrypt 実装）を取得する。
 *
 * NOTE: BcryptPasswordHasher は hash と compare の両方を持つが、
 * ActivateAccountUseCase が要求するのは hash のみ。
 * authorize で compare が必要な場合は直接 BcryptPasswordHasher を使う。
 */
export function getPasswordHasher(): PasswordHasher {
  return new BcryptPasswordHasher();
}
