import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";
import { internalServerError, unauthorizedResponse } from "@/lib/api-helpers";
import { getCurrentUserId } from "@/lib/session";

/**
 * GET /api/my/participations
 * ログインユーザーの参加予定一覧を取得
 *
 * クエリパラメータ:
 * - excludeCancelled: "true" の場合、キャンセル済みを除外（デフォルト: true）
 * - upcoming: "true" の場合、今後の体験のみ取得（デフォルト: false）
 *
 * レスポンス:
 * - 200: 参加予定一覧（スケジュール・プロジェクト情報含む）
 * - 401: 未認証
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 認証チェック
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorizedResponse();
    }

    // 2. クエリパラメータ取得
    const { searchParams } = new URL(request.url);
    const excludeCancelled = searchParams.get("excludeCancelled") !== "false";
    const upcoming = searchParams.get("upcoming") === "true";

    // 3. 参加予定一覧を取得（スケジュールとプロジェクト情報を含む）
    const whereCondition: Prisma.ParticipationWhereInput = {
      guestId: userId,
      ...(excludeCancelled && { status: { not: "CANCELLED" as const } }),
      ...(upcoming && {
        schedule: {
          startDateTime: { gte: new Date() },
        },
      }),
    };

    const participations = await prisma.participation.findMany({
      where: whereCondition,
      include: {
        schedule: {
          include: {
            project: {
              select: {
                id: true,
                title: true,
                location: true,
                imageUrls: true,
                host: {
                  select: {
                    id: true,
                    name: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        schedule: {
          startDateTime: "asc",
        },
      },
    });

    // 4. レスポンス整形
    const now = new Date();
    const result = participations.map((p) => ({
      id: p.id,
      participantCount: p.participantCount,
      status: p.status,
      appliedAt: p.appliedAt.toISOString(),
      // 過去の体験かどうか
      isPast: new Date(p.schedule.startDateTime) < now,
      schedule: {
        id: p.schedule.id,
        title: p.schedule.title,
        description: p.schedule.description,
        startDateTime: p.schedule.startDateTime.toISOString(),
        duration: p.schedule.duration,
        requirements: p.schedule.requirements,
      },
      project: {
        id: p.schedule.project.id,
        title: p.schedule.project.title,
        location: p.schedule.project.location,
        imageUrl: p.schedule.project.imageUrls[0] || null,
        host: p.schedule.project.host,
      },
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Get my participations error:", error);
    return internalServerError();
  }
}
