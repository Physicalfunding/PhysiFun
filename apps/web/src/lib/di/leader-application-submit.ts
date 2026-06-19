import { KyselySubmitLeaderApplicationAdapter } from "@physifun/infrastructure/src/kysely";
import type { SubmitLeaderApplicationPort } from "@physifun/application";

/**
 * SubmitLeaderApplicationUseCase 用のポート生成ヘルパー（#222 で Kysely 実装へ移行）
 *
 * ## なぜ leader-application.ts から分離しているのか
 * Kysely は ESM 専用パッケージで、`@physifun/infrastructure/src/kysely` を import すると
 * Jest (CommonJS) のテストが解決に失敗する（詳細はサブバレル `src/kysely.ts` のコメント参照）。
 * `leader-application.ts` は IP レートリミットポートの Jest テストから import されるため、
 * Kysely を読み込む本ヘルパーだけをこのファイルに隔離する（project DI と同じ方針）。
 *
 * アダプタは stateless なので DI 関数ごとに独自インスタンス化する。
 */
export function getSubmitLeaderApplicationPort(): SubmitLeaderApplicationPort {
  return new KyselySubmitLeaderApplicationAdapter();
}
