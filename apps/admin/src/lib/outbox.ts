/**
 * Outbox 監視 UI 用のファサード
 *
 * DB クエリは @physifun/infrastructure の KyselyOutboxQueryService / KyselyOutboxCommandAdapter に委譲。
 * このファイルは DTO 変換と admin UI 固有のロジックのみを担当する。
 */
export {
  type OutboxSource,
  type OutboxStatus,
  isValidOutboxSource as isValidSource,
  isValidOutboxStatus as isValidStatus,
  deriveOutboxStatus,
} from "@physifun/infrastructure";
