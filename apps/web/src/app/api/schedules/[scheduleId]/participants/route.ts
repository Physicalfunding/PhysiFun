import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { internalServerError, unauthorizedResponse } from "@/lib/api-helpers";
import { getCurrentUserId, isHost } from "@/lib/session";

/**
 * GET /api/schedules/[scheduleId]/participants
 * スケジュールの参加者一覧を取得（ホスト向け）
 *
 * レスポンス:
 * - 200: 参加者一覧
 * - 401: 未認証
 * - 403: ホスト権限なし または 自分のプロジェクトではない
 * - 404: スケジュールが見つからない
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ scheduleId: string }> }
) {
  try {
    // 1. 認証チェック
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorizedResponse();
    }

    // 2. ホスト権限チェック
    const hostPermission = await isHost();
    if (!hostPermission) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "ホスト権限が必要です",
          },
        },
        { status: 403 }
      );
    }

    // 3. スケジュール取得
    const { scheduleId } = await params;

    const schedule = await prisma.experienceSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        project: {
          select: {
            id: true,
            hostId: true,
            title: true,
          },
        },
        participations: {
          where: {
            status: { not: "CANCELLED" },
          },
          include: {
            guest: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: {
            appliedAt: "desc",
          },
        },
      },
    });

    if (!schedule) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "スケジュールが見つかりません",
          },
        },
        { status: 404 }
      );
    }

    // 4. 自分のプロジェクトかチェック
    if (schedule.project.hostId !== userId) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "このスケジュールの参加者を閲覧する権限がありません",
          },
        },
        { status: 403 }
      );
    }

    // 5. レスポンス整形
    const currentParticipantCount = schedule.participations.reduce(
      (sum, p) => sum + p.participantCount,
      0
    );

    const result = {
      schedule: {
        id: schedule.id,
        title: schedule.title,
        startDateTime: schedule.startDateTime.toISOString(),
        capacity: schedule.capacity,
      },
      project: {
        id: schedule.project.id,
        title: schedule.project.title,
      },
      participants: schedule.participations.map((p) => ({
        id: p.id,
        participantCount: p.participantCount,
        status: p.status,
        appliedAt: p.appliedAt.toISOString(),
        guest: p.guest,
      })),
      currentParticipantCount,
      remainingCapacity: schedule.capacity - currentParticipantCount,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Get participants error:", error);
    return internalServerError();
  }
}
