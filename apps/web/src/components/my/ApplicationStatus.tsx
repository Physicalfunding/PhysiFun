import Link from "next/link";
import type { MyLatestLeaderApplication } from "@physifun/application";
import { CATEGORY_MASTER } from "@physifun/domain";
import { Card, CardContent } from "@/components/common";

/**
 * 応募状況の表示（`/my/application`。#374）
 *
 * データはページ（Server Component）がサーバー側で読んで渡す。ここは表示だけ。
 * 出し分けは「審査中」「却下」「応募なし」の 3 つ（設計書 §4 の 2・§5.2）。
 * 最新の応募が承認済み（APPROVED）の人はリーダーなので、ページ側で `/my/projects` へ移しており、
 * ここに来るのはリーダーでないのに APPROVED という起きないはずの組み合わせだけ。その場合は「応募なし」と同じに扱う（§5.1）。
 *
 * 審査B（公開の審査）と区別するため、「審査中」は単独で書かず、必ず「リーダー応募を審査中」と書く。
 */
interface ApplicationStatusProps {
  /** アカウントのメールアドレス（審査結果の送り先） */
  email: string;
  /** 最新の応募。無ければ null */
  application: MyLatestLeaderApplication | null;
}

export function ApplicationStatus({ email, application }: ApplicationStatusProps) {
  if (application?.status === "PENDING") {
    return <PendingStatus email={email} application={application} />;
  }
  if (application?.status === "REJECTED") {
    return <RejectedStatus application={application} />;
  }
  return <NoApplication />;
}

function PendingStatus({
  email,
  application,
}: {
  email: string;
  application: MyLatestLeaderApplication;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <div
            className="rounded-lg bg-yellow-50 p-6 text-yellow-900"
            data-testid="application-status"
            data-status="PENDING"
          >
            <h2 className="text-xl font-bold">リーダー応募を審査中です</h2>
            <p className="mt-3 font-medium break-words">「{application.projectTitle}」</p>
            <p className="mt-1">運営チームが内容を確認しています。</p>
            <p className="mt-3 text-sm">
              審査の結果は <span className="font-medium break-all">{email}</span>{" "}
              にメールでお知らせします。
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h3 className="mb-3 text-lg font-semibold text-gray-900">承認されたあとの流れ</h3>
          <ol className="list-decimal space-y-2 pl-5 text-gray-700">
            <li>リーダーになり、応募内容をもとにプロジェクトの下書きが用意されます。</li>
            <li>
              下書きを仕上げて公開申請すると、公開の前にもう一度、運営チームが内容を確認します。
            </li>
          </ol>
        </CardContent>
      </Card>

      <ApplicationSummary application={application} />
    </div>
  );
}

function RejectedStatus({ application }: { application: MyLatestLeaderApplication }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <div
            className="rounded-lg bg-red-50 p-6 text-red-900"
            data-testid="application-status"
            data-status="REJECTED"
          >
            <h2 className="text-xl font-bold">リーダー応募は承認されませんでした</h2>
            <p className="mt-3 break-words">
              {`ご応募いただいたプロジェクト案「${application.projectTitle}」は、今回は見送らせていただくことになりました。`}
            </p>
            {/* 却下では理由の入力が必須（RejectLeaderApplicationUseCase）。念のため無いときは欄ごと出さない */}
            {application.reviewerNote && (
              <div className="mt-4">
                <p className="text-sm font-semibold">理由</p>
                <p className="mt-1 whitespace-pre-wrap break-words">{application.reviewerNote}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <ApplicationSummary application={application} />
    </div>
  );
}

function NoApplication() {
  return (
    <Card>
      <CardContent>
        <div className="py-12 text-center" data-testid="application-status" data-status="NONE">
          <p className="text-gray-900">応募はまだありません</p>
          <p className="mt-2 text-sm text-gray-500">
            リーダーに応募すると、ここで応募の状況を確かめられます。
          </p>
          <Link
            href="/apply"
            className="mt-6 inline-block rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
          >
            リーダーに応募する
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

/** 応募内容の控え（審査中・却下で共通） */
function ApplicationSummary({ application }: { application: MyLatestLeaderApplication }) {
  return (
    <Card>
      <CardContent>
        <h3 className="mb-4 text-lg font-semibold text-gray-900">応募内容の控え</h3>
        <dl className="space-y-3">
          <div>
            <dt className="text-sm font-medium text-gray-500">プロジェクトタイトル</dt>
            <dd className="mt-1 break-words text-gray-900">{application.projectTitle}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">概要</dt>
            <dd className="mt-1 whitespace-pre-wrap break-words text-gray-900">
              {application.projectSummary}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">カテゴリ</dt>
            <dd className="mt-1 text-gray-900">{getCategoryLabel(application.projectCategory)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">応募日</dt>
            <dd className="mt-1 text-gray-900">{formatJstDate(application.submittedAt)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function getCategoryLabel(value: string): string {
  return CATEGORY_MASTER.find((c) => c.value === value)?.label ?? value;
}

/**
 * 「2026年11月3日」の形（JST）。サーバーで描くので、実行環境のタイムゾーン（Vercel は UTC）に左右されないよう JST を指定する
 */
const JST_DATE_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "long",
  day: "numeric",
});

function formatJstDate(date: Date): string {
  return JST_DATE_FORMATTER.format(date);
}
