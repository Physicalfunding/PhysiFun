import Link from "next/link";
import { RegisterForm } from "@/components/auth/RegisterForm";

/**
 * ユーザー登録ページ
 */
export default function RegisterPage() {
  return (
    <div className="flex min-h-screen flex-col justify-center bg-gray-50 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* ロゴ/タイトル */}
        <h1 className="text-center text-3xl font-bold tracking-tight text-gray-900">
          Campfire Experience
        </h1>
        <h2 className="mt-6 text-center text-2xl font-semibold text-gray-900">
          新規アカウント作成
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          焚き火を囲むように、みんなで温かく応援し合える場所へようこそ
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white px-4 py-8 shadow sm:rounded-lg sm:px-10">
          <RegisterForm />

          {/* ログインリンク */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-gray-500">または</span>
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                すでにアカウントをお持ちの方は{" "}
                <Link href="/login" className="font-medium text-orange-600 hover:text-orange-500">
                  ログイン
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
