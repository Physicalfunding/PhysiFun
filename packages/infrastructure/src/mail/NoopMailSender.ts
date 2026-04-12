import { ok, type Result } from "@physifun/domain";
import type { MailMessage, MailSender, MailSendError } from "./types";

/**
 * テスト用の MailSender。実際のメール送信は行わない。
 * 送信されたメッセージは `sentMessages` 配列に蓄積される。
 */
export class NoopMailSender implements MailSender {
  readonly sentMessages: MailMessage[] = [];

  /** send() が返す結果を外部から制御するためのフック */
  nextResult: Result<void, MailSendError> = ok(undefined);

  async send(message: MailMessage): Promise<Result<void, MailSendError>> {
    this.sentMessages.push(message);
    return this.nextResult;
  }

  /** テスト間でリセットする */
  reset(): void {
    this.sentMessages.length = 0;
    this.nextResult = ok(undefined);
  }
}
