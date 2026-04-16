import type { Project } from "@physifun/domain";

/**
 * RequestPublishUseCase で発行する Outbox メッセージのパラメータ
 *
 * id / type / payload を持つ共通構造。leader-application の
 * CreateOutboxMessageParams と同じ形だが、プロジェクトドメイン用に
 * 別テーブル（ProjectOutboxMessage）へ書き込むため型を分離する。
 */
export interface CreateProjectOutboxMessageParams {
  readonly id: string;
  readonly type: string;
  readonly payload: unknown;
}

/**
 * RequestPublishUseCase のポートインターフェース
 *
 * インフラ層で実装する。公開申請は Project.status 更新と
 * ProjectOutboxMessage への書き込みを同一トランザクションで実行する。
 */
export interface RequestPublishPort {
  /** プロジェクトID で Project 集約を取得する */
  findProjectById(projectId: string): Promise<Project | null>;

  /**
   * Project 集約の更新と Outbox メッセージ作成を
   * 1 つのトランザクションで実行する。
   *
   * Outbox パターン: 運営への公開申請通知メール送信タスクを
   * DB に永続化し、後段のワーカーが拾って配信する。
   */
  executeInTransaction(params: {
    project: Project;
    outboxMessage: CreateProjectOutboxMessageParams;
  }): Promise<void>;
}
