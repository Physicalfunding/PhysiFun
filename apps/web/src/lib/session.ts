import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

/**
 * サーバーサイドでセッションを取得するヘルパー関数
 *
 * Server Components や API Routes で使用する。
 * @example
 * const session = await getSession();
 * if (!session) {
 *   redirect("/login");
 * }
 */
export async function getSession() {
  return getServerSession(authOptions);
}

/**
 * 現在のユーザー（Account）ID を取得する。
 * 未ログインの場合は null を返す。
 */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.id ?? null;
}
