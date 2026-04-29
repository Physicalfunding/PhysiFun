import { test, expect, ADMIN_BASE_URL } from "../fixtures";
import { prisma } from "../helpers/db";
import { buildMagicLinkUrl, seedMagicLinkToken } from "../helpers/admin-auth";

/**
 * 09. Magic Link ログイン happy path (#150)
 *
 * - ACTIVE な AdminAccount を作成
 * - test 側で生 token + ハッシュ済 token を生成し、AdminVerificationToken に直接 INSERT
 *   (NextAuth v4 は DB にハッシュ済 token を保存するため、`POST /api/auth/signin/email`
 *   経由では DB から生 token を復元できない。詳細は helpers/admin-auth.ts のコメント参照)
 * - 署名済み Magic Link URL を組み立てて navigate
 * - AdminSession が新規作成され、`/` に着地できる (= getAuthenticatedAdminId が成功)
 */
test("ACTIVE な AdminAccount は Magic Link でログインでき、AdminSession が発行される", async ({
  browser,
}) => {
  // 既存の admin@e2e-test.local (setup で seed) と衝突しないよう専用 email を使う。
  const email = "happy-path@e2e-test.local";

  // 既存 token / session の影響を排除する (前 spec のリトライ等で残っていた場合)
  await prisma.adminVerificationToken.deleteMany({ where: { identifier: email } });
  await prisma.adminAccount.upsert({
    where: { email },
    update: { status: "ACTIVE" },
    create: { email, status: "ACTIVE" },
  });

  // 1. AdminVerificationToken を直接 INSERT し、URL 用の生 token を取得する
  const { rawToken, expires } = await seedMagicLinkToken({ email });

  // 2. ハッシュ済 token は後段 (consume 確認) で参照する
  const tokenRow = await prisma.adminVerificationToken.findFirst({
    where: { identifier: email },
    orderBy: { expires: "desc" },
  });
  expect(tokenRow).not.toBeNull();

  // 3. 本番と同じ署名付き URL を組み立てる (URL 上は生 token を載せる)
  const magicLinkUrl = buildMagicLinkUrl({
    email,
    token: rawToken,
    expires,
  });

  // 4. クリーンなコンテキストで Magic Link を踏む → AdminSession 発行
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(magicLinkUrl);
  await page.waitForLoadState("domcontentloaded");

  // 認証成功時は callbackUrl (= ADMIN_BASE_URL/) に着地する。
  expect(page.url()).not.toContain("/login");
  expect(page.url()).not.toContain("error=");

  // 5. AdminSession が DB に作成されたことを確認
  const sessions = await prisma.adminSession.findMany({
    where: { adminAccount: { email } },
  });
  expect(sessions.length).toBeGreaterThanOrEqual(1);

  // 6. 同じ Cookie で保護ページに再アクセスしても通る (= 認証維持)
  await page.goto(`${ADMIN_BASE_URL}/`);
  await page.waitForLoadState("domcontentloaded");
  expect(page.url()).not.toContain("/login");

  // 7. AdminVerificationToken は consume されて削除されている
  const remainingToken = await prisma.adminVerificationToken.findFirst({
    where: { identifier: email, token: tokenRow!.token },
  });
  expect(remainingToken).toBeNull();

  await context.close();
});
