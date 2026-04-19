import bcrypt from "bcryptjs";

/**
 * bcrypt によるパスワードハッシュ化 / 検証アダプタ
 *
 * application 層の PasswordHasher インターフェース（hash のみ）に構造的部分型で適合する。
 * NextAuth authorize 等で必要な compare も同クラスに持たせる。
 *
 * NOTE: 循環依存 (infrastructure → application) を避けるため、
 * PasswordHasher 型は直接 import しない。
 */
export class BcryptPasswordHasher {
  /**
   * bcrypt cost factor。
   * 10 は開発速度とセキュリティのバランスが取れた一般的な値。
   */
  private static readonly DEFAULT_COST = 10;

  constructor(private readonly cost: number = BcryptPasswordHasher.DEFAULT_COST) {}

  /**
   * パスワードを bcrypt でハッシュ化する。
   */
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.cost);
  }

  /**
   * 平文パスワードと bcrypt ハッシュを比較する。
   * bcrypt.compare は内部的に constant-time 比較を行う。
   */
  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
