import { prisma } from "@physifun/infrastructure";
import { ACTIVATION_EMAIL_TYPE } from "@physifun/infrastructure";

/**
 * LeaderApplicationOutbox から ACTIVATION_EMAIL メッセージを取得し、
 * payload.activationToken を返す。
 *
 * Outbox レコードは ApplyForm 送信時にアプリケーション層で同一トランザクションで
 * 作成されるため、Worker の送信完了を待たずに token を取り出せる。
 *
 * @param email 宛先メールアドレス (念のため検証する)
 * @param timeoutMs Outbox レコード作成を待つ最大時間 (ms)
 */
export async function getActivationToken(
  email: string,
  timeoutMs = 10_000
): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase();
  const deadline = Date.now() + timeoutMs;

  // 送信後に Outbox レコードが書き込まれるまで少しラグがあるかもしれないので
  // 短時間リトライする
  while (Date.now() < deadline) {
    const message = await prisma.leaderApplicationOutboxMessage.findFirst({
      where: { type: ACTIVATION_EMAIL_TYPE },
      orderBy: { createdAt: "desc" },
    });

    if (message) {
      const payload = message.payload as {
        accountId?: string;
        email?: string;
        displayName?: string;
        activationToken?: string;
      };

      if (payload.email?.toLowerCase() !== normalizedEmail) {
        throw new Error(
          `Outbox メール宛先の不一致: expected=${normalizedEmail}, got=${payload.email}`
        );
      }

      if (!payload.activationToken) {
        throw new Error("Outbox payload に activationToken が含まれていません");
      }

      return payload.activationToken;
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  throw new Error(
    `ACTIVATION_EMAIL の Outbox メッセージが ${timeoutMs}ms 以内に見つかりませんでした (email=${normalizedEmail})`
  );
}
