import { test, expect } from "../fixtures";
import {
  countVerificationTokens,
  db,
  deleteVerificationTokens,
  findAdminSessionsByEmail,
  upsertAdminAccount,
} from "../helpers/db";
import {
  buildMagicLinkUrl,
  readLatestVerificationToken,
  requestAdminMagicLink,
} from "../helpers/admin-auth";

/**
 * 10. Magic Link 失敗系 (#150)
 *
 * - 未登録 email: AdminVerificationToken が作られない (signIn callback が false)
 * - DISABLED AdminAccount: 同上
 * - レート制限超過: 6 回目の送信で AdminVerificationToken が作られない
 * - 不正な HMAC 署名: 既発行 token がある状態で改ざん URL → /login?error=AccessDenied
 *   かつ AdminVerificationToken は consume されない
 *
 * 各テストは email を独立させて互いの状態 (rate limit / token DB) を干渉させない。
 */

test("未登録 email への Magic Link 送信は AdminVerificationToken を作らない", async ({
  request,
}) => {
  const email = "unregistered@e2e-test.local";
  // 念のため掃除
  await deleteVerificationTokens(email);
  await db.deleteFrom("admin_accounts").where("email", "=", email).execute();

  await requestAdminMagicLink(request, email);

  const token = await readLatestVerificationToken(email);
  expect(token).toBeNull();
});

test("DISABLED な AdminAccount への Magic Link 送信は AdminVerificationToken を作らない", async ({
  request,
}) => {
  const email = "disabled@e2e-test.local";
  await deleteVerificationTokens(email);
  await upsertAdminAccount(email, "DISABLED");

  await requestAdminMagicLink(request, email);

  const token = await readLatestVerificationToken(email);
  expect(token).toBeNull();
});

test("Magic Link 送信のレート制限 (5 回 / 15 分) を超えると 6 回目はトークンが作られない", async ({
  request,
}) => {
  const email = "rate-limit@e2e-test.local";
  await deleteVerificationTokens(email);
  await upsertAdminAccount(email, "ACTIVE");

  // 5 回までは作成される
  for (let i = 0; i < 5; i++) {
    await requestAdminMagicLink(request, email);
  }
  const beforeOver = await countVerificationTokens(email);
  expect(beforeOver).toBe(5);

  // 6 回目はレート制限で signIn callback が false → 新しいトークンは作られない
  await requestAdminMagicLink(request, email);
  const afterOver = await countVerificationTokens(email);
  expect(afterOver).toBe(5);
});

test("不正な HMAC 署名の Magic Link は AccessDenied で弾かれ、トークンは consume されない", async ({
  browser,
  request,
}) => {
  const email = "bad-hmac@e2e-test.local";
  await deleteVerificationTokens(email);
  await upsertAdminAccount(email, "ACTIVE");

  await requestAdminMagicLink(request, email);
  const tokenRow = await readLatestVerificationToken(email);
  expect(tokenRow).not.toBeNull();

  // 攻撃者が secret を知らない想定で、別の secret で署名した URL を作る。
  // route handler の HMAC 検証で signature_mismatch → /login?error=AccessDenied
  const tamperedUrl = buildMagicLinkUrl({
    email,
    token: tokenRow!.token,
    expires: tokenRow!.expires,
    secret: "attacker-secret-totally-different",
  });

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(tamperedUrl);
  await page.waitForURL(/\/login/);
  expect(page.url()).toContain("error=AccessDenied");

  // AdminVerificationToken は HMAC 検証段階で弾かれているため consume されていない。
  // (= 正規ユーザは secret さえ知らなければ後から正しい URL を踏み直せる)
  const stillThere = await db
    .selectFrom("admin_verification_tokens")
    .select("token")
    .where("identifier", "=", email)
    .where("token", "=", tokenRow!.token)
    .executeTakeFirst();
  expect(stillThere).toBeDefined();

  // AdminSession は作成されていない
  const sessions = await findAdminSessionsByEmail(email);
  expect(sessions.length).toBe(0);

  await context.close();
});
