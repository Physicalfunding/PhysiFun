import { type Result, err, ok } from "../../shared/result";
import type { AdminAccountStateError } from "../errors/AdminAccountError";
import { AdminAccountEmail, type AdminAccountEmailError } from "../value-objects/AdminAccountEmail";
import { AdminAccountId } from "../value-objects/AdminAccountId";
import { AdminAccountStatus } from "../value-objects/AdminAccountStatus";

/**
 * AdminAccount 集約ルート (#140 / #144 / #145)
 *
 * 運営アカウントを表すドメインエンティティ。
 * apps/web で利用する Account とは完全に独立した認証基盤を構成する。
 *
 * - #145 で認証方式を Magic Link (NextAuth EmailProvider) に変更。
 *   パスワード・TOTP・リカバリコードは廃止 (parent Issue #140 で方針転換)。
 * - 集約状態は `ACTIVE` / `DISABLED` の 2 値
 * - 状態遷移は集約メソッド (`disable()` / `enable()`) 経由でのみ行う
 *
 * 参照: `docs/202604_初回リリースに向けた計画/運営アプリ.md`
 */
export class AdminAccount {
  private constructor(
    private readonly _id: AdminAccountId,
    private _email: AdminAccountEmail,
    private _status: AdminAccountStatus,
    private _lastLoginAt: Date | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  /**
   * 新規 AdminAccount を作成する (初期運営 seed / 運営追加 UI から呼ばれる)。
   *
   * - status は `ACTIVE` 固定
   * - 時刻はテストから注入可能
   */
  static create(input: {
    email: AdminAccountEmail;
    /** 省略時は `AdminAccountId.generate()`。 */
    id?: AdminAccountId;
    /** 省略時は `new Date()`。 */
    now?: Date;
  }): AdminAccount {
    const now = input.now ?? new Date();
    return new AdminAccount(
      input.id ?? AdminAccountId.generate(),
      input.email,
      AdminAccountStatus.ACTIVE,
      null,
      now,
      now
    );
  }

  /**
   * 生のメール文字列から新規 AdminAccount を生成する (#148 / #158 L4)。
   *
   * 運営追加 UI や seed から直接呼ぶためのショートカット。
   * email の正規化・検証は `AdminAccountEmail.from` に委譲するため、
   * 呼び出し側は "文字列を渡せば集約が整合した状態で作られる" という
   * 不変条件を得られる (value object を組み立てる責務を集約に閉じる)。
   */
  static createFromRawEmail(input: {
    email: string;
    id?: AdminAccountId;
    now?: Date;
  }): Result<AdminAccount, AdminAccountEmailError> {
    const emailResult = AdminAccountEmail.from(input.email);
    if (!emailResult.ok) return emailResult;
    return ok(
      AdminAccount.create({
        email: emailResult.value,
        id: input.id,
        now: input.now,
      })
    );
  }

  /**
   * 永続化層から AdminAccount を復元する (Repository 実装が呼ぶ)。
   * DB 値をそのまま復元するのみで、状態遷移ルールは適用しない。
   */
  static reconstruct(input: {
    id: AdminAccountId;
    email: AdminAccountEmail;
    status: AdminAccountStatus;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): AdminAccount {
    return new AdminAccount(
      input.id,
      input.email,
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

  // ---- Predicates ----

  /** ACTIVE かどうか (呼び出し側の三項演算を減らすための糖衣)。 */
  isActive(): boolean {
    return this._status === AdminAccountStatus.ACTIVE;
  }

  /** DISABLED かどうか。 */
  isDisabled(): boolean {
    return this._status === AdminAccountStatus.DISABLED;
  }

  // ---- State transitions ----

  /**
   * アカウントを無効化する (管理 UI から強制無効化)。
   * 既存の AdminSession は別途 DELETE して revoke する。
   *
   * DISABLED → DISABLED は運営 UI でエラーフィードバックしたいため
   * `Result` で返す (enable() が冪等 void なのと非対称なのは意図的)。
   *
   * #148 / #158 L4: 「自分自身は無効化できない」ガードを集約に集約する。
   * 呼び出し側 (Route Handler) はこの集約メソッドを経由することで
   * `CANNOT_DISABLE_SELF` エラーをドメイン境界の内側で一元管理できる。
   */
  disable(input?: {
    now?: Date;
    /** 操作者 (ログイン中の運営) の AdminAccount.id。指定時は自己無効化を弾く。 */
    operatorId?: AdminAccountId;
  }): Result<void, AdminAccountStateError> {
    if (input?.operatorId && this._id.equals(input.operatorId)) {
      return err({ type: "CANNOT_DISABLE_SELF" });
    }
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
   * ログイン成功時に lastLoginAt を更新する。
   */
  recordLogin(input?: { at?: Date }): void {
    const at = input?.at ?? new Date();
    this._lastLoginAt = at;
    this._updatedAt = at;
  }
}
