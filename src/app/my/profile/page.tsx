import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ProfileEditForm } from "@/components/profile/ProfileEditForm";
import { AvatarUpload } from "@/components/profile/AvatarUpload";
import { GetProfileUseCase } from "@/application/use-cases/profile/GetProfileUseCase";
import { PrismaUserRepository } from "@/infrastructure/database/repositories/PrismaUserRepository";
import { prisma } from "@/infrastructure/database/prisma";

/**
 * プロフィールページのメタデータ
 */
export const metadata = {
  title: "プロフィール編集 | Campfire Experience",
  description: "プロフィール情報を編集します",
};

/**
 * プロフィールページ
 * Server Componentとしてユーザー情報を取得し、クライアントコンポーネントに渡す
 */
export default async function ProfilePage() {
  // 1. セッション確認
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/my/profile");
  }

  // 2. プロフィール情報取得
  const userRepository = new PrismaUserRepository(prisma);
  const useCase = new GetProfileUseCase(userRepository);

  const result = await useCase.execute({ userId: session.user.id });

  if (!result.success) {
    // ユーザーが見つからない場合はログインページへ
    redirect("/login");
  }

  const profile = result.data;

  // 3. ユーザータイプのラベル変換
  const userTypeLabels = {
    HOST: "ホスト（体験を提供する）",
    GUEST: "ゲスト（体験に参加する）",
    BOTH: "両方",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* ページヘッダー */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">プロフィール編集</h1>
          <p className="mt-1 text-sm text-gray-600">プロフィール情報を更新できます</p>
        </div>

        {/* プロフィールカード */}
        <div className="overflow-hidden rounded-lg bg-white shadow">
          {/* アバターセクション */}
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-8">
            <div className="flex flex-col items-center sm:flex-row sm:items-start sm:space-x-6">
              {/* アバター画像アップロード */}
              <div className="mb-4 sm:mb-0">
                <AvatarUpload currentAvatarUrl={profile.avatarUrl} userName={profile.name} />
              </div>
              <div className="text-center text-white sm:text-left">
                <h2 className="text-xl font-semibold">{profile.name}</h2>
                <p className="text-sm text-orange-100">{profile.email}</p>
                <span className="mt-1 inline-block rounded-full bg-white/20 px-2 py-0.5 text-xs">
                  {userTypeLabels[profile.userType]}
                </span>
              </div>
            </div>
          </div>

          {/* 編集フォーム */}
          <div className="p-6">
            <ProfileEditForm
              initialData={{
                id: profile.id,
                email: profile.email,
                name: profile.name,
                bio: profile.bio,
                avatarUrl: profile.avatarUrl,
                userType: profile.userType,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
