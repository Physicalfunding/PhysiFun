import { type Result, err, ok } from "../../shared/result";
import type { AdminAccountStateError } from "../errors/AdminAccountError";
import { AdminAccountEmail } from "../value-objects/AdminAccountEmail";
import { AdminAccountId } from "../value-objects/AdminAccountId";
import { AdminAccountStatus } from "../value-objects/AdminAccountStatus";
import { HashedPassword } from "../value-objects/HashedPassword";
import type { RecoveryCodeHash } from "../value-objects/RecoveryCodeHash";
import { TotpSecret } from "../value-objects/TotpSecret";

/**
 * AdminAccount 集約ルート (#140 / #144)
 *
 * 運営アカウントを表すドメインエンティティ。
 * apps/web で利用する Account とは完全に独立した認証基盤を構成する。
 *
 * - メール + パスワード + TOTP による二要素認証 (#146 で接続)
 * - リカバリコードはハッシュ化して配列で保持 (原本は生成時のみ表示)
 * - 集約状態は `ACTIVE` / `DISABLED` の 2 値
 * - 状態遷移は集約メソッド (`disable()` / `enableTotp()` 等) 経由でのみ行う
 *
 * 参照: `docs/202604_初回リリースに向けた計画/運営アプリ.md`
 */
export class AdminAccount {
  private constructor(
    private readonly _id: AdminAccountId,
    private _email: AdminAccountEmail,
    private _passwordHash: HashedPassword,
    private _totpSecret: TotpSecret | null,
    private _totpEnabled: boolean,
    private _recoveryCodes: readonly RecoveryCodeHash[],
    private _status: AdminAccountStatus,
    private _lastLoginAt: Date | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  /**
   * 新規 AdminAccount を作成する (初期運営 seed / 運営追加 UI から呼ばれる)。
   *
   * - status は `ACTIVE` 固定
   * - TOTP は未設定状態 (enableTotp() で #146 で有効化)
   * - 時刻はテストから注入可能
   */
  static create(input: {
    email: AdminAccountEmail;
    passwordHash: HashedPassword;
    /** 省略時は `AdminAccountId.generate()`。 */
    id?: AdminAccountId;
    /** 省略時は `new Date()`。 */
    now?: Date;
  }): AdminAccount {
    const now = input.now ?? new Date();
    return new AdminAccount(
      input.id ?? AdminAccountId.generate(),
      input.email,
      input.passwordHash,
      null,
      false,
      [],
      AdminAccountStatus.ACTIVE,
      null,
      now,
      now
    );
  }

  /**
   * 永続化層から AdminAccount を復元する (Repository 実装が呼ぶ)。
   * DB 値をそのまま復元するのみで、状態遷移ルールは適用しない。
   */
  static reconstruct(input: {
    id: AdminAccountId;
    email: AdminAccountEmail;
    passwordHash: HashedPassword;
    totpSecret: TotpSecret | null;
    totpEnabled: boolean;
    recoveryCodes: readonly RecoveryCodeHash[];
    status: AdminAccountStatus;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): AdminAccount {
    return new AdminAccount(
      input.id,
      input.email,
      input.passwordHash,
      input.totpSecret,
      input.totpEnabled,
      input.recoveryCodes,
      input.status,
      input.lastLoginAt,
      input.createdAt,
      input.updatedAt
    );
  }

  // ---- Getters ----

  get id(): AdminAccountId {
    return this._id;
  }

  get email(): AdminAccountEmail {
    return this._email;
  }

  get passwordHash(): HashedPassword {
    return this._passwordHash;
  }

  get totpSecret(): TotpSecret | null {
    return this._totpSecret;
  }

  get totpEnabled(): boolean {
    return this._totpEnabled;
  }

  get recoveryCodes(): readonly RecoveryCodeHash[] {
    return this._recoveryCodes;
  }

  get status(): AdminAccountStatus {
    return this._status;
  }

  get lastLoginAt(): Date | null {
    return this._lastLoginAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // ---- State transitions ----

  /**
   * アカウントを無効化する (管理 UI から強制無効化)。
   * 既存の AdminSession は別途 DELETE して revoke する。
   *
   * DISABLED → DISABLED は運営 UI でエラーフィードバックしたいため
   * `Result` で返す (enable() が冪等 void なのと非対称なのは意図的)。
   */
  disable(input?: { now?: Date }): Result<void, AdminAccountStateError> {
    if (this._status === AdminAccountStatus.DISABLED) {
      return err({ type: "CANNOT_DISABLE_ALREADY_DISABLED" });
    }
    this._status = AdminAccountStatus.DISABLED;
    this._updatedAt = input?.now ?? new Date();
    return ok(undefined);
  }

  /**
   * 無効化されたアカウントを再有効化する (管理 UI から復活)。
   *
   * 既に ACTIVE な場合は冪等に何もしない (void)。
   * 運営 UI 側では ACTIVE 再有効化で失敗表示が不要なため
   * disable() とは意図的に API が非対称。
   */
  enable(input?: { now?: Date }): void {
    if (this._status === AdminAccountStatus.ACTIVE) {
      return;
    }
    this._status = AdminAccountStatus.ACTIVE;
    this._updatedAt = input?.now ?? new Date();
  }

  /**
   * TOTP セットアップを完了させ二要素認証を有効化する (#146 で使用)。
   *
   * - secret が未設定だとエラー
   * - 既に enabled ならエラー (再設定フローは別メソッドを想定)
   */
  enableTotp(input: {
    secret: TotpSecret;
    recoveryCodes: readonly RecoveryCodeHash[];
    now?: Date;
  }): Result<void, AdminAccountStateError> {
    if (this._status === AdminAccountStatus.DISABLED) {
      return err({ type: "ACCOUNT_DISABLED" });
    }
    if (this._totpEnabled) {
      return err({ type: "TOTP_ALREADY_ENABLED" });
    }
    this._totpSecret = input.secret;
    this._totpEnabled = true;
    this._recoveryCodes = input.recoveryCodes;
    this._updatedAt = input.now ?? new Date();
    return ok(undefined);
  }

  /**
   * パスワードハッシュを差し替える (パスワード変更 / 初期発行)。
   */
  changePassword(input: { passwordHash: HashedPassword; now?: Date }): void {
    this._passwordHash = input.passwordHash;
    this._updatedAt = input.now ?? new Date();
  }

  /**
   * ログイン成功時に lastLoginAt を更新する。
   */
  recordLogin(input?: { at?: Date }): void {
    const at = input?.at ?? new Date();
    this._lastLoginAt = at;
    this._updatedAt = at;
  }
}
