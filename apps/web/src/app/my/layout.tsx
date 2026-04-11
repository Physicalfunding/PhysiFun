import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

/**
 * マイページ共通レイアウト
 * 認証が必要なページ群のラッパー
 * ログインしていない場合はログインページへリダイレクト
 */
export default async function MyPageLayout({ children }: { children: React.ReactNode }) {
  // 認証チェック（Server Componentで実行）
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main>{children}</main>
    </div>
  );
}
