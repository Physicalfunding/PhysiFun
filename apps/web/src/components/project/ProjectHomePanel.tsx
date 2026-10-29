import type { ReactNode } from "react";
import type { ProjectStoryDocument } from "@physifun/domain";
import { ProjectStoryView, SafeSnsLink } from "@physifun/ui-shared";
import { Card, CardContent } from "@/components/common";
import { SelectTabButton } from "./ProjectPublicTabs";

const SNS_LABEL: Record<string, string> = {
  x: "X (Twitter)",
  instagram: "Instagram",
  facebook: "Facebook",
  website: "ウェブサイト",
};

interface Props {
  /** 本文（ストーリー）。null のときは左の列に `emptyState` を出す */
  body: ProjectStoryDocument | null;
  leaderIntroduction: string | null;
  /** リーダー（オーナー）の表示用の情報。公開ページ・マイページの DTO で同じ形 */
  leader: { displayName: string; bio: string | null };
  snsLinks: Record<string, string | null> | null;
  activityPlan: string | null;
  /** 本文が無いときに左の列へ出す内容（マイページの「まだコンテンツがありません」など） */
  emptyState?: ReactNode;
}

/**
 * プロジェクトページ「ホーム」タブの中身（#316、設計書 §5.6）。
 * 公開ページ（ProjectPublicView）とマイページ（ProjectDetail）で共有する。
 *
 * - PC（lg 以上）は 2 列（左 2 : 右 1）。左にストーリー、右の列に上から
 *   リーダー紹介（頭文字の丸・名前・紹介文・SNS）→ 活動計画 →「サポート募集を見る」ボタン
 * - スマホは 1 列。右の列は DOM の順どおりストーリーの下に並ぶ
 * - 「サポート募集を見る」は ProjectPublicTabs の「サポート募集」タブに切り替える
 *   （タブの状態は ProjectPublicTabs が持つので、Context 経由で呼ぶ）
 * - リーダー紹介が空のときはアカウントの bio を出す（残すかは #213 で決める）
 */
export function ProjectHomePanel({
  body,
  leaderIntroduction,
  leader,
  snsLinks,
  activityPlan,
  emptyState,
}: Props) {
  const snsEntries = snsLinks
    ? Object.entries(snsLinks).filter(
        (entry): entry is [string, string] => entry[1] != null && entry[1] !== ""
      )
    : [];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* 左の列: ストーリー。min-w-0 で、長い URL などがあっても列の幅を超えないようにする */}
      <div className="min-w-0 lg:col-span-2">
        {body ? (
          <Card>
            <CardContent>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">ストーリー</h3>
              <ProjectStoryView story={body} />
            </CardContent>
          </Card>
        ) : (
          emptyState
        )}
      </div>

      {/* 右の列 */}
      <aside className="min-w-0 space-y-6" aria-label="リーダー紹介と活動計画">
        <Card>
          <CardContent>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">リーダー紹介</h3>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600 font-bold text-sm">
                {leader.displayName.charAt(0) || "?"}
              </div>
              <p className="font-medium text-gray-900 break-words">{leader.displayName}</p>
            </div>
            {leaderIntroduction && (
              <p className="mt-3 text-sm text-gray-700 whitespace-pre-wrap break-words">
                {leaderIntroduction}
              </p>
            )}
            {leader.bio && !leaderIntroduction && (
              <p className="mt-3 text-sm text-gray-700 whitespace-pre-wrap break-words">
                {leader.bio}
              </p>
            )}
            {/* SNS リンク — defense-in-depth: SafeSnsLink 内部で javascript: 等を遮断 */}
            {snsEntries.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2" aria-label="SNS / ウェブサイト">
                {snsEntries.map(([key, url]) => (
                  <li
                    key={key}
                    className="rounded-full border border-gray-200 bg-white px-3 py-0.5"
                  >
                    <SafeSnsLink label={SNS_LABEL[key] || key} url={url} variant="listItem" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {activityPlan && (
          <Card>
            <CardContent>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">活動計画</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap break-words leading-relaxed">
                {activityPlan}
              </p>
            </CardContent>
          </Card>
        )}

        <SelectTabButton tab="support">サポート募集を見る</SelectTabButton>
      </aside>
    </div>
  );
}
