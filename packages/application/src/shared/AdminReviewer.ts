/**
 * 審査者（AdminAccount）情報の共通型
 *
 * 運営承認・差戻・強制非公開ユースケースで、reviewer の ID バリデーションと
 * 連絡用メールアドレス取得に使う最小限の情報を表す。
 *
 * Issue #145 により Admin は AdminAccount テーブルに分離されたため、
 * Account.roles の "ADMIN" ロール検証ではなく AdminAccount.id + status=ACTIVE
 * で reviewer を同定する。インフラ側のアダプタが DISABLED を弾いて null を返すため、
 * UseCase 側で role チェックする必要はなくなっている。
 */
export interface AdminReviewer {
  readonly id: string;
  readonly email: string;
}
