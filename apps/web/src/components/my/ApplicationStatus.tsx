"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, Button, LoadingSpinner } from "@/components/common";
import { useToast } from "@/components/common/Toast";
import { CATEGORY_MASTER } from "@physifun/domain";

type ApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";

interface Application {
  id: string;
  status: ApplicationStatus;
  projectTitle: string;
  projectSummary: string;
  projectCategory: string;
  submittedAt: string;
}

const STATUS_CONFIG: Record<
  ApplicationStatus,
  { icon: string; title: string; message: string; bgClass: string; textClass: string }
> = {
  PENDING: {
    icon: "\u23F3",
    title: "審査中",
    message: "応募内容を確認しています。審査結果をお待ちください。",
    bgClass: "bg-yellow-50",
    textClass: "text-yellow-800",
  },
  APPROVED: {
    icon: "\u2705",
    title: "承認済み",
    message: "おめでとうございます！リーダーとして承認されました。",
    bgClass: "bg-green-50",
    textClass: "text-green-800",
  },
  REJECTED: {
    icon: "\u274C",
    title: "非承認",
    message: "申し訳ありませんが、今回の応募は承認されませんでした。",
    bgClass: "bg-red-50",
    textClass: "text-red-800",
  },
};

function getCategoryLabel(value: string): string {
  const found = CATEGORY_MASTER.find((c) => c.value === value);
  return found ? found.label : value;
}

export function ApplicationStatus() {
  const [application, setApplication] = useState<Application | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEmpty, setIsEmpty] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    async function fetchApplication() {
      try {
        const res = await fetch("/api/my/application");
        if (!res.ok) {
          showToast("応募情報の取得に失敗しました", "error");
          setIsLoading(false);
          return;
        }
        const json = await res.json();
        if (json.data?.application) {
          setApplication(json.data.application);
        } else {
          setIsEmpty(true);
        }
      } catch {
        showToast("応募情報の取得に失敗しました", "error");
      } finally {
        setIsLoading(false);
      }
    }
    fetchApplication();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <LoadingSpinner size="lg" message="読み込み中..." />
      </div>
    );
  }

  if (isEmpty || !application) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-500">応募情報が見つかりません</p>
        </CardContent>
      </Card>
    );
  }

  const config = STATUS_CONFIG[application.status];

  return (
    <div className="space-y-6">
      {/* ステータスカード */}
      <Card>
        <CardContent>
          <div
            className={`rounded-lg p-6 ${config.bgClass}`}
            data-testid="application-status"
            data-status={application.status}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">{config.icon}</span>
              <div>
                <h2 className={`text-xl font-bold ${config.textClass}`}>{config.title}</h2>
                <p className={`mt-1 ${config.textClass}`}>{config.message}</p>
              </div>
            </div>
            {application.status === "APPROVED" && (
              <div className="mt-4">
                <Link href="/my/projects">
                  <Button variant="primary">プロジェクトを始める</Button>
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* プロジェクト情報カード */}
      <Card>
        <CardContent>
          <h3 className="mb-4 text-lg font-semibold text-gray-900">プロジェクト情報</h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">プロジェクトタイトル</dt>
              <dd className="mt-1 text-gray-900">{application.projectTitle}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">プロジェクト概要</dt>
              <dd className="mt-1 text-gray-900">{application.projectSummary}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">カテゴリ</dt>
              <dd className="mt-1 text-gray-900">
                {getCategoryLabel(application.projectCategory)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">応募日時</dt>
              <dd className="mt-1 text-gray-900">
                {new Date(application.submittedAt).toLocaleDateString("ja-JP", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
