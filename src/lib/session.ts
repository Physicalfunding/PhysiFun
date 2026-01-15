import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

/**
 * サーバーサイドでセッションを取得するヘルパー関数
 *
 * Server ComponentsやAPI Routesで使用
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
 * 現在のユーザーIDを取得
 * 未ログインの場合はnullを返す
 */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.id ?? null;
}

/**
 * ユーザーがホスト権限を持つかチェック
 */
export async function isHost(): Promise<boolean> {
  const session = await getSession();
  const userType = session?.user?.userType;
  return userType === "HOST";
}

/**
 * ユーザーがゲスト権限を持つかチェック
 */
export async function isGuest(): Promise<boolean> {
  const session = await getSession();
  const userType = session?.user?.userType;
  return userType === "GUEST";
}
