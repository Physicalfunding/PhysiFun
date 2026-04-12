/**
 * CreateProjectDraftUseCase が依存するポートインターフェース
 *
 * アプリケーション層は Prisma に直接依存せず、このポートを介して
 * インフラストラクチャ層と通信する。インフラ層が実装を提供する。
 */

import type { Project } from "@physifun/domain";

/**
 * アカウントのロール
 */
export type AccountRole = "SUPPORTER" | "LEADER" | "ADMIN";

/**
 * プロジェクト作成時に必要なアカウント情報
 */
export interface AccountForProjectCreation {
  readonly id: string;
  readonly roles: AccountRole[];
}

/**
 * CreateProjectDraft ユースケースのポート
 */
export interface CreateProjectDraftPort {
  /**
   * アカウント ID でアカウントを検索する。
   */
  findAccountById(accountId: string): Promise<AccountForProjectCreation | null>;

  /**
   * 指定アカウントが所有するプロジェクト数（全ステータス）を返す。
   */
  countProjectsByOwner(accountId: string): Promise<number>;

  /**
   * プロジェクトを永続化する。
   */
  saveProject(project: Project): Promise<void>;
}
