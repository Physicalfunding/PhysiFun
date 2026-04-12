/**
 * CreateProjectDraftUseCase が依存するポートインターフェース
 *
 * アプリケーション層は Prisma に直接依存せず、このポートを介して
 * インフラストラクチャ層と通信する。インフラ層が実装を提供する。
 */

import type { Project } from "@physifun/domain";
import type { AccountRole } from "../../shared/AccountRole";

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
   * 件数チェック + プロジェクト保存をアトミックに実行する。
   *
   * インフラ層は同一トランザクション内で件数チェックと INSERT を行い、
   * TOCTOU を防止すること。上限超過時は例外をスローする。
   */
  countAndSaveProject(params: {
    project: Project;
    accountId: string;
    maxCount: number;
  }): Promise<void>;
}
