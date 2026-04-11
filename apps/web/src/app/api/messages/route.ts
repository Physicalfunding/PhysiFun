import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/infrastructure/database/prisma";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";

/**
 * POST /api/messages
 * 新規メッセージを送信
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const body = await request.json();
    const { receiverId, subject, body: messageBody } = body;

    // バリデーション
    if (!receiverId) {
      return NextResponse.json({ error: "受信者IDは必須です" }, { status: 400 });
    }

    if (!subject || subject.trim() === "") {
      return NextResponse.json({ error: "件名は必須です" }, { status: 400 });
    }

    if (!messageBody || messageBody.trim() === "") {
      return NextResponse.json({ error: "本文は必須です" }, { status: 400 });
    }

    // 自分自身への送信を禁止
    if (session.user.id === receiverId) {
      return NextResponse.json(
        { error: "自分自身にメッセージを送信することはできません" },
        { status: 400 }
      );
    }

    // 送信権限チェック（参加申し込み関係があるか）
    const hasPermission = await checkSendPermission(session.user.id, receiverId);
    if (!hasPermission) {
      return NextResponse.json(
        { error: "この相手にメッセージを送信する権限がありません" },
        { status: 403 }
      );
    }

    // メッセージを作成
    const message = await prisma.message.create({
      data: {
        senderId: session.user.id,
        receiverId,
        subject: subject.trim(),
        body: messageBody.trim(),
        isRead: false,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: message,
    });
  } catch (error) {
    console.error("Message creation error:", error);
    return NextResponse.json({ error: "メッセージの送信に失敗しました" }, { status: 500 });
  }
}

/**
 * GET /api/messages
 * ユーザーのメッセージ一覧を取得
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "received"; // received | sent | all

    let whereCondition: Prisma.MessageWhereInput;

    switch (type) {
      case "sent":
        whereCondition = { senderId: session.user.id };
        break;
      case "all":
        whereCondition = {
          OR: [{ senderId: session.user.id }, { receiverId: session.user.id }],
        };
        break;
      case "received":
      default:
        whereCondition = { receiverId: session.user.id };
        break;
    }

    const messages = await prisma.message.findMany({
      where: whereCondition,
      orderBy: { createdAt: "desc" },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    // 未読件数も取得
    const unreadCount = await prisma.message.count({
      where: {
        receiverId: session.user.id,
        isRead: false,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        messages,
        unreadCount,
      },
    });
  } catch (error) {
    console.error("Messages fetch error:", error);
    return NextResponse.json({ error: "メッセージの取得に失敗しました" }, { status: 500 });
  }
}

/**
 * 送信権限をチェック
 * ゲスト↔ホスト間で、参加申し込み関係がある場合のみ送信可能
 */
async function checkSendPermission(senderId: string, receiverId: string): Promise<boolean> {
  // ケース1: 送信者がゲストの場合
  // 送信者の参加申し込みがあり、そのプロジェクトのホストが受信者
  const senderAsGuestParticipations = await prisma.participation.findMany({
    where: { guestId: senderId },
    include: {
      schedule: {
        include: {
          project: true,
        },
      },
    },
  });

  for (const participation of senderAsGuestParticipations) {
    if (participation.schedule.project.hostId === receiverId) {
      return true;
    }
  }

  // ケース2: 送信者がホストの場合
  // 受信者の参加申し込みがあり、そのプロジェクトのホストが送信者
  const receiverAsGuestParticipations = await prisma.participation.findMany({
    where: { guestId: receiverId },
    include: {
      schedule: {
        include: {
          project: true,
        },
      },
    },
  });

  for (const participation of receiverAsGuestParticipations) {
    if (participation.schedule.project.hostId === senderId) {
      return true;
    }
  }

  return false;
}
