import { test, expect, ADMIN_BASE_URL, ADMIN_STORAGE, WEB_BASE_URL } from "../fixtures";

/**
 * 08. Cookie 分離検証 (#150)
 *
 * apps/admin と apps/web の認証 Cookie が混入しても、互いの認証境界を侵害しないことを確認する。
 *
 * 本番では admin が `admin.<domain>` 配下、web が `<domain>` / `app.<domain>` 配下に
 * 分離されており、host-only cookie のおかげで Cookie 自体が相互配送されない。
 * E2E では両方が `localhost` (port のみ違う) のため Cookie 自体は両アプリに送られるが、
 * 検証側の挙動 (admin: AdminSession.sessionToken DB 検索 / web: NextAuth JWT verify)
 * が独立しているため、相手側の Cookie 値ではどちらも認証されない。
 *
 * このテストはその「Cookie 値はクロス送信されても、認証は通らない」性質を担保する。
 */

test.describe("Cookie 分離: admin / web の認証は互いに通らない", () => {
  test("admin 認証済み Cookie で web の保護ページにアクセスしても /login に飛ばされる", async ({
    browser,
  }) => {
    // ADMIN_STORAGE には admin_sessions に登録済みの sessionToken が next-auth.session-token
    // として保存されている。web は JWT 戦略のため、この UUID を JWT として decode できず
    // 認証されない (= /my/* は withAuth により未認可扱い)。
    const context = await browser.newContext({ storageState: ADMIN_STORAGE });
    const page = await context.newPage();

    await page.goto(`${WEB_BASE_URL}/my/application`);
    // apps/web は pages.signIn = "/login" のため withAuth はここに飛ばす。
    await page.waitForURL(/\/login(\?|$)/);
    expect(page.url()).toContain(`${WEB_BASE_URL}/login`);

    await context.close();
  });

  test("web で leader ログイン後の Cookie で admin にアクセスしても /login に飛ばされる", async ({
    browser,
  }) => {
    // 02-activate.spec で leader Account (ACTIVE) が作られている前提。
    // ブラウザコンテキストを介さず request fixture で credentials サインインするのは
    // NextAuth の流儀から外れる (CSRF cookie 必須) ため、UI からログインする。
    const context = await browser.newContext();
    const page = await context.newPage();

    // ログイン (apps/web の credentials provider) — TEST_LEADER は 02-activate で
    // パスワードを設定済み。
    await page.goto(`${WEB_BASE_URL}/login`);
    await page.getByLabel("メールアドレス").fill("leader@e2e-test.local");
    await page.getByLabel("パスワード").fill("LeaderPass123!");
    await page.getByRole("button", { name: "ログイン" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));

    // この時点で context には apps/web 由来の next-auth.session-token (JWT) が入っている。
    // localhost の Cookie は port を区別しないため、このまま admin にアクセスすると
    // 同じ Cookie が送られる。admin は AdminSession 行を DB 検索するので、JWT 値では
    // 一致せず middleware は通っても RSC の `getAuthenticatedAdminId` が null を返し
    // /login にリダイレクトする。
    await page.goto(`${ADMIN_BASE_URL}/`);
    await page.waitForURL(/\/login(\?|$)/);
    expect(page.url()).toContain(`${ADMIN_BASE_URL}/login`);

    await context.close();
  });
});
