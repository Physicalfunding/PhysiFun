import type { LeaderApplicationStatus } from "@physifun/domain";

/**
 * ログインしている本人の応募の状態を読む、読み取り専用のクエリポート（#373）
 *
 * 応募状況の画面と、`/my/projects` ↔ `/my/application` の振り分けで使う。
 * 本人以外の応募を読めないように、引数はアカウント ID だけにする（応募 ID で読む口は作らない）。
 */

// ==================== DTO 型 ====================

/**
 * 応募状況の画面に出す、最新の応募
 */
export interface MyLatestLeaderApplication {
  readonly id: string;
  readonly status: LeaderApplicationStatus;
  readonly projectTitle: string;
  readonly projectSummary: string;
  readonly projectCategory: string;
  readonly submittedAt: Date;
  /** 審査のコメント。却下では理由が入る（却下時は必須） */
  readonly reviewerNote: string | null;
}

/**
 * 本人のアカウントと応募の状態
 */
export interface MyLeaderApplicationStatusDTO {
  /** ロールに `LEADER` があるか */
  readonly isLeader: boolean;
  /** アカウントのメールアドレス（審査結果の送り先） */
  readonly email: string;
  /** `submittedAt` が一番新しい応募。応募が無ければ null */
  readonly latestApplication: MyLatestLeaderApplication | null;
}

// ==================== ポートインターフェース ====================

export interface MyLeaderApplicationQueryPort {
  /**
   * アカウントのロール・メールアドレスと、最新の応募を返す。
   *
   * アカウントが無ければ null を返す。
   */
  findStatusByAccountId(accountId: string): Promise<MyLeaderApplicationStatusDTO | null>;
}
