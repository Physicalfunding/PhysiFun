import { PrismaSubmitLeaderApplicationAdapter } from "@physifun/infrastructure";
import type { SubmitLeaderApplicationPort } from "@physifun/application";

/**
 * SubmitLeaderApplicationUseCase 用のポート生成ヘルパー
 *
 * infrastructure の Prisma アダプタを SubmitLeaderApplicationPort に適合させる。
 * アダプタは stateless なので DI 関数ごとに独自インスタンス化する。
 */
export function getSubmitLeaderApplicationPort(): SubmitLeaderApplicationPort {
  return new PrismaSubmitLeaderApplicationAdapter();
}
