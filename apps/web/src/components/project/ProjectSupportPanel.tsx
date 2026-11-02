import type { RecruitmentDTO } from "@physifun/application";
import { Card, CardContent } from "@/components/common";
import { APPROVAL_MODE_LABELS, formatScheduleDate } from "@/lib/scheduleFormat";

interface Props {
  /** 公開中プロジェクトのサポート募集（募集は作成順、日程は日付順）。`PublicProjectQueryPort.findPublishedRecruitmentsBySlug` の結果 */
  recruitments: readonly RecruitmentDTO[];
}

/**
 * プロジェクト公開ページ「サポート募集」タブの中身（#219、業務仕様: docs-repository `サポート募集.md` §3〜§4）。
 *
 * 募集ごとにタイトル・説明と日程の一覧（日付・時間帯・1 時間ごとの定員・承認モード）を**表示だけ**する。
 *
 * TODO(一般公開): サポーターの申請（`SupportTicket`）は一般公開で実装するので、このタブには申請ボタンを置いていない。
 * 申請の導線（日程ごとの「この日程で申請する」ボタンと、終了時刻を過ぎた日程の受付終了・「最終受付まで○日」の表示。
 * `サポート募集.md` §4.4）は、申請フローと一緒にここへ足す。
 */
export function ProjectSupportPanel({ recruitments }: Props) {
  if (recruitments.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <p className="text-gray-400 text-lg">現在、サポート募集はありません</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {recruitments.map((recruitment) => (
        <Card key={recruitment.id}>
          <CardContent>
            <h2 className="text-lg font-semibold text-gray-900 break-words">{recruitment.title}</h2>
            <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap break-words">
              {recruitment.description}
            </p>

            <div className="mt-4 border-t border-gray-100 pt-4">
              <h3 className="text-sm font-semibold text-gray-900">日程</h3>
              {recruitment.schedules.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">日程はまだ決まっていません</p>
              ) : (
                <ul className="mt-2 divide-y divide-gray-100">
                  {recruitment.schedules.map((schedule) => (
                    <li
                      key={schedule.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm text-gray-700"
                    >
                      <span className="font-medium text-gray-900">
                        {formatScheduleDate(schedule.date)}
                      </span>
                      <span>
                        {schedule.startTime}〜{schedule.endTime}
                      </span>
                      <span>1 時間 {schedule.capacityPerHour} 人まで</span>
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {APPROVAL_MODE_LABELS[schedule.approvalMode]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
