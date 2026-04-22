import type { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { getAdminMagicLinkHmacSecret } from "@physifun/infrastructure";
import { getAdminPrismaAdapter, getIsActiveAdminByEmail, getSendAdminMagicLink } from "./di/auth";
import { checkAdminMagicLinkRateLimit } from "./rateLimit";
import { EMAIL_MAGIC_LINK_MAX_AGE_SEC } from "./auth-constants";

/**
 * 起動時 (authOptions の import 時) に ADMIN_MAGIC_LINK_HMAC_SECRET の設定を検証する (#146)。
 *
 * 未設定 / 空 / NEXTAUTH_SECRET と同一値なら throw (fail closed)。
 * Build 時には env が無い可能性があるため、`NODE_ENV === "test"` と
 * `NEXT_PHASE === "phase-production-build"` のビルド時相当はスキップする。
 *
 * 実行時 (sendVerificationRequest / callback route) では getAdminMagicLinkHmacSecret()
 * が都度呼ばれるため、起動時に失敗してもランタイムでは fail closed が維持される。
 */
function assertAdminMagicLinkHmacSecretOnBoot(): void {
  if (process.env.NODE_ENV === "test") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  // throw されたら Next.js のサーバ起動時に検出される。
  getAdminMagicLinkHmacSecret();
}
assertAdminMagicLinkHmacSecretOnBoot();

/**
 * 運営管理アプリ用 NextAuth.js 設定 (#145 / #157)
 *
 * 認証方式: Magic Link (EmailProvider) + Database セッション戦略
 *
 * - AdminAccount テーブルから ACTIVE なアカウントのみをログイン許可 (AdminPrismaAdapter 内で制御)。
 * - マジックリンク送信は Resend 経由 (sendVerificationRequest で差し込み)。
 * - 既知の email のみログイン可能。createUser は adapter 側で throw する。
 * - セッション TTL = 3600s (1h)。DB 側 (admin_sessions) の expires と一致。
 * - AdminSession 行を DELETE すれば即座に強制 revoke される (deleteSession / getSessionAndUser)。
 *
 * ## 開放リレー対策 (#157 C1)
 * NextAuth v4 EmailProvider は `getUserByEmail` が null でも合成ユーザを作って
 * `sendVerificationRequest` まで流すため、`callbacks.signIn` で AdminAccount 実在 +
 * ACTIVE をチェックし、未登録 email への送信を遮断する。また `adminMagicLink` アクションの
 * レート制限 (5 回 / 15 分 / email) で同一 email への連投も抑止する。
 *
 * セキュリティ方針 (#140):
 *   - パスワード / TOTP は採用しない (#144 で追加した列は #145 migration で削除済み)。
 *   - 数名の運営のみがアクセスする想定。マジックリンク到達性で本人性を担保。
 *   - 万一トークン漏洩しても AdminSession の強制削除で即座に revoke 可能。
 */

/**
 * Cookie 設定を生成する純粋関数 (#147 Blocker B-1)
 *
 * `authOptions.cookies` は元々 `process.env.NEXTAUTH_URL` を直接参照していたため、
 * テストでは動的 import (`import("../auth?t=...")`) で module cache をバイパスして
 * 再評価する必要があった。これを `isHttps: boolean` を引数に取る純粋関数に切り出し、
 * テストから `buildCookieOptions(true) / buildCookieOptions(false)` を直接呼べるように
 * している。
 *
 * - host-only cookie 方針 (domain 未指定) を invariant として固定
 * - `isHttps=true` のときのみ `__Secure-` / `__Host-` プレフィックス + secure=true
 * - sameSite は "lax" で固定 (マジックリンクの戻りナビゲーションを許可)
 */
export function buildCookieOptions(isHttps: boolean): NextAuthOptions["cookies"] {
  const securePrefix = isHttps ? "__Secure-" : "";
  const hostPrefix = isHttps ? "__Host-" : "";
  return {
    sessionToken: {
      name: `${securePrefix}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isHttps,
        // domain は敢えて指定しない (host-only cookie にして親ドメイン漏れを防止)
        domain: undefined,
      },
    },
    callbackUrl: {
      name: `${securePrefix}next-auth.callback-url`,
      options: {
        // `httpOnly: true` を明示して JS アクセス禁止 (#147 H-1)。
        // NextAuth v4 は `authOptions.cookies` を shallow merge するので、ここで
        // options オブジェクト全体を渡した時点で callbackUrl エントリは完全に
        // 上書きされる (NextAuth 内部の defaultCookies は参照されない)。
        // 以前のコメントは「デフォルトに委ねる」としていたが、実際は `httpOnly`
        // 未指定 = `undefined` (= false 扱い) で Cookie 発行されていたため、
        // client-side JS から callbackUrl cookie が読めてしまう状態だった。
        // apps/admin の signIn 動線は `window.location.href` を使うフォーム /
        // リンク経由 (サーバーリダイレクト) なので、client-side JS から
        // callbackUrl cookie を直接読む必要は無く、httpOnly を立てても問題ない。
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isHttps,
        domain: undefined,
      },
    },
    csrfToken: {
      // CSRF Cookie は NextAuth 既定で __Host- プレフィックス付き。
      // __Host- は domain 属性が無いこと + path=/ + secure を要求するため、
      // サブドメイン分離と相性が良い。
      name: `${hostPrefix}next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isHttps,
        // __Host- プレフィックスの仕様上 domain は必ず未指定
        domain: undefined,
      },
    },
  };
}

/**
 * NEXTAUTH_SECRET の fail-closed (#147 M-3)
 *
 * 本番環境で `NEXTAUTH_SECRET` が未設定だと NextAuth v4 は起動時に
 * ランダムな値を生成してログに警告を出すだけで続行してしまう。Database 戦略なら
 * Session Cookie 自体は DB キーなので直接は致命傷にならないが、verification token
 * (マジックリンク) の署名 / 復号鍵として使われるため、未設定のまま再デプロイすると
 * 既発行リンクが全て invalid になる / デプロイ毎に secret が変わってユーザが
 * サイレントにログアウトされる等の運用リスクが残る。
 * 本番では起動を失敗させることで、環境変数設定漏れをデプロイ時点で検知する
 * (ADMIN_MAGIC_LINK_HMAC_SECRET と同じ fail-closed ポリシー)。
 */
if (process.env.NODE_ENV === "production" && !process.env.NEXTAUTH_SECRET) {
  throw new Error("NEXTAUTH_SECRET must be set in production");
}

export const authOptions: NextAuthOptions = {
  adapter: getAdminPrismaAdapter(),

  providers: [
    EmailProvider({
      // ⚠️ server / from は実際には使われない。
      // NextAuth の EmailProvider は本来 nodemailer を使って SMTP 送信するが、
      // ここでは `sendVerificationRequest` を明示指定しているため nodemailer は
      // 初期化されず、送信は ResendMailSender 経由に差し替わる。
      // ただし EmailProvider のスキーマ上 server / from が必須 (undefined 不可) なので
      // 形だけ満たすためのダミー値を入れている。誤って SMTP を叩こうとしても
      // host:"unused" で解決不能になり実害は無いが、変更時は意図を誤解しないこと。
      server: { host: "unused", port: 0, auth: { user: "unused", pass: "unused" } },
      from: process.env.MAIL_FROM ?? "noreply@physifun.com",
      maxAge: EMAIL_MAGIC_LINK_MAX_AGE_SEC, // #158 M4: verify-request UI と同じ定数を参照
      async sendVerificationRequest(params) {
        const send = getSendAdminMagicLink();
        await send(params);
      },
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,

  session: {
    strategy: "database",
    maxAge: 60 * 60, // 1h (運営アプリは web より短い)
    updateAge: 10 * 60, // 10 分以上経過時のみ expires を更新 (書き込み量削減)
  },

  /**
   * Cookie 設定 (#147)
   *
   * apps/admin は `admin.<本番ドメイン>` 配下の独立 Vercel プロジェクトとしてデプロイする。
   * apps/web (`<本番ドメイン>` もしくは `app.<本番ドメイン>`) と Cookie が混ざると:
   *   - 運営セッションが誤って一般ユーザ側に流出する
   *   - Cookie 名衝突で片方のログイン状態が壊れる
   * といったリスクがあるため、以下の方針を明示する:
   *
   * 1. `domain` 属性を **設定しない** (= host-only cookie)。
   *    こうすると Cookie は `admin.example.com` に完全一致でしかマッチせず、
   *    親ドメイン `example.com` や兄弟サブドメイン `app.example.com` には送出されない。
   *    NextAuth v4 のデフォルトが host-only (domain 未指定) なので、明示的に
   *    `undefined` を記述して将来の改変に対する invariant を固定している。
   * 2. `sameSite: "lax"` — マジックリンクのコールバックは別ドメイン (メール内リンク) から
   *    トップレベルナビゲーションで戻るため、`lax` が必要。`strict` にするとクリック直後の
   *    セッション確立に失敗する。
   * 3. `secure` フラグは本番 (NEXTAUTH_URL が https) で自動的に true になる NextAuth の
   *    既定挙動に委ねる (Cookie 名も `__Secure-` プレフィックス付きが自動選択される)。
   *
   * NEXTAUTH_SECRET は apps/web と **別値** を Vercel 環境変数に設定すること
   * (同一値だと署名付き Cookie を相互に復号できてしまい、ドメイン分離の意味が薄れる)。
   */
  cookies: buildCookieOptions(process.env.NEXTAUTH_URL?.startsWith("https://") ?? false),

  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify-request",
    error: "/login",
  },

  callbacks: {
    /**
     * signIn callback (#157 C1 / H1 / #158 L1)
     *
     * Magic Link 送信フロー (`email.verificationRequest === true`) のときのみ:
     *   1. レート制限 (email 単位 5/15min) を消費。超過なら false を返して送信中断
     *   2. `user` が NextAuth の合成ユーザ (getUserByEmail が null -> {id: email, email} に
     *      フォールバック) であれば false を返して送信遮断
     *   3. 念のため isActiveAdminByEmail で再チェック (二重防御)
     *
     * false を返すと NextAuth は AccessDenied を投げ、`createVerificationToken` /
     * `sendVerificationRequest` はいずれも実行されない。エラーは pages.error (/login)
     * にリダイレクトされるため、クライアントからは「メール送信失敗」の表示になる。
     *
     * ## 2 回クエリする理由 (#158 L1)
     * NextAuth は内部で `adapter.getUserByEmail` を呼んだ後に signIn callback を呼ぶため、
     * isActiveAdminByEmail を追加するとクエリが 2 回走る構図になる。これは意図的:
     * - 合成ユーザ判定 (`user.id === address`) を高速パスとして手前に置き、
     *   未登録/DISABLED email は 2 回目のクエリ前に弾く
     * - 2 回目 (isActiveAdminByEmail) は adapter 実装と signIn callback が別ファイルに
     *   なっていることに対する防御的チェック。片方を変更しても security invariant を
     *   保つため残す (adapter がリグレッションで非 ACTIVE を返しても signIn で救える)
     *
     * 非 verificationRequest 経路 (= マジックリンククリック後のコールバック等) は
     * adapter.getUserByEmail が ACTIVE のみを返す仕様と合わさって弾かれるため、
     * ここでは true を返す。
     */
    async signIn({ user, email }) {
      if (!email?.verificationRequest) {
        return true;
      }
      const rawAddress = user.email;
      if (!rawAddress) {
        return false;
      }
      // 大文字違い (e.g. "Alice@Example.com" vs "alice@example.com") でレート制限を
      // バイパスされないよう正規化する (#157 H3)。AdminAccount.email は seed 時点で
      // 小文字で保存しているので DB 検索も同じ正規化形でマッチする。
      const address = rawAddress.trim().toLowerCase();
      if (!address) {
        return false;
      }

      const rate = checkAdminMagicLinkRateLimit(address);
      if (!rate.ok) {
        // AccessDenied にフォールバック。クライアントは EmailSignin エラーを受け取る。
        return false;
      }

      // 高速パス: NextAuth が getUserByEmail=null のときに作る合成ユーザは
      // `id === email` となる。DB 由来の AdminAccount は id が UUID なので、
      // この等価で合成 / 実 AdminAccount を区別できる (#158 L1)。
      if (user.id === address || user.id === rawAddress) {
        return false;
      }

      // 二重防御: adapter/getUserByEmail が壊れた場合でも非 ACTIVE は弾く。
      const isAdmin = await getIsActiveAdminByEmail()(address);
      if (!isAdmin) {
        return false;
      }
      return true;
    },

    async session({ session, user }) {
      // Database 戦略では `user` が AdapterUser (= AdminAccount 由来) なので
      // id を session.user.id にコピーする (Route Handler で参照するため)。
      if (session.user && user?.id) {
        session.user.id = user.id;
      }
      return session;
    },
  },
};
