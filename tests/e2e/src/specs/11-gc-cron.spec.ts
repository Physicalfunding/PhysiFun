import { randomUUID } from "node:crypto";
import { test, expect, ADMIN_BASE_URL } from "../fixtures";
import { prisma } from "../helpers/db";
import { cronAuthHeader } from "../helpers/admin-auth";

/**
 * 11. /api/cron/gc-admin-auth による期限切れ GC (#150)
 *
 * - 期限切れ AdminVerificationToken と AdminSession を直接 INSERT
 * - Bearer CRON_SECRET 付き GET でエンドポイントを叩く
 * - 期限切れ行が DELETE され、未期限行は残ることを確認
 * - 認証なし / 不正な Bearer は 401
 */

test("CRON_SECRET 付き GET で期限切れ AdminSession / AdminVerificationToken が削除される", async ({
  request,
}) => {
  const email = "gc-target@e2e-test.local";
  const account = await prisma.adminAccount.upsert({
    where: { email },
    update: { status: "ACTIVE" },
    create: { email, status: "ACTIVE" },
  });

  // 期限切れトークン
  const expiredToken = `expired-token-${randomUUID()}`;
  const validToken = `valid-token-${randomUUID()}`;
  await prisma.adminVerificationToken.createMany({
    data: [
      {
        identifier: email,
        token: expiredToken,
        expires: new Date(Date.now() - 60 * 60 * 1000), // 1h 前
      },
      {
        identifier: email,
        token: validToken,
        expires: new Date(Date.now() + 10 * 60 * 1000), // 10 分後
      },
    ],
  });

  // 期限切れ AdminSession
  const expiredSessionToken = randomUUID();
  const validSessionToken = randomUUID();
  await prisma.adminSession.createMany({
    data: [
      {
        sessionToken: expiredSessionToken,
        adminAccountId: account.id,
        expires: new Date(Date.now() - 60 * 60 * 1000),
      },
      {
        sessionToken: validSessionToken,
        adminAccountId: account.id,
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    ],
  });

  // cron 実行
  const res = await request.get(`${ADMIN_BASE_URL}/api/cron/gc-admin-auth`, {
    headers: cronAuthHeader(),
  });
  expect(res.status()).toBe(200);
  const json = (await res.json()) as { deletedSessions: number; deletedVerificationTokens: number };
  expect(json.deletedSessions).toBeGreaterThanOrEqual(1);
  expect(json.deletedVerificationTokens).toBeGreaterThanOrEqual(1);

  // 期限切れは削除済み
  const expiredTokenStill = await prisma.adminVerificationToken.findFirst({
    where: { token: expiredToken },
  });
  expect(expiredTokenStill).toBeNull();
  const expiredSessionStill = await prisma.adminSession.findUnique({
    where: { sessionToken: expiredSessionToken },
  });
  expect(expiredSessionStill).toBeNull();

  // 未期限は残っている
  const validTokenStill = await prisma.adminVerificationToken.findFirst({
    where: { token: validToken },
  });
  expect(validTokenStill).not.toBeNull();
  const validSessionStill = await prisma.adminSession.findUnique({
    where: { sessionToken: validSessionToken },
  });
  expect(validSessionStill).not.toBeNull();
});

test("Authorization ヘッダ未設定 / 不正な Bearer は 401 を返す", async ({ request }) => {
  const noAuth = await request.get(`${ADMIN_BASE_URL}/api/cron/gc-admin-auth`);
  expect(noAuth.status()).toBe(401);

  const wrongAuth = await request.get(`${ADMIN_BASE_URL}/api/cron/gc-admin-auth`, {
    headers: { authorization: "Bearer wrong-secret" },
  });
  expect(wrongAuth.status()).toBe(401);
});
