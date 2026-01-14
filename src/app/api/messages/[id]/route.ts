import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/infrastructure/database/prisma";
import { authOptions } from "@/lib/auth";

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/messages/[id]
 * メッセージの詳細とスレッドを取得
 */
export async function GET(request: NextRequest, { params }: Props) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { id: messageId } = await params;

    // メッセージを取得
    const message = await prisma.message.findUnique({
      where: { id: messageId },
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

    if (!message) {
      return NextResponse.json({ error: "メッセージが見つかりません" }, { status: 404 });
    }

    // 送信者または受信者のみアクセス可
    if (message.senderId !== session.user.id && message.receiverId !== session.user.id) {
      return NextResponse.json({ error: "アクセス権限がありません" }, { status: 403 });
    }

    // スレッドを取得（親メッセージとその返信）
    const parentMessageId = message.parentMessageId || message.id;
    const thread = await prisma.message.findMany({
      where: {
        OR: [{ id: parentMessageId }, { parentMessageId: parentMessageId }],
      },
      orderBy: { createdAt: "asc" },
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
      data: {
        message,
        thread,
      },
    });
  } catch (error) {
    console.error("Message fetch error:", error);
    return NextResponse.json({ error: "メッセージの取得に失敗しました" }, { status: 500 });
  }
}

/**
 * PATCH /api/messages/[id]
 * メッセージを既読にする
 */
export async function PATCH(request: NextRequest, { params }: Props) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { id: messageId } = await params;

    // メッセージを取得
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return NextResponse.json({ error: "メッセージが見つかりません" }, { status: 404 });
    }

    // 受信者のみ既読にできる
    if (message.receiverId !== session.user.id) {
      return NextResponse.json({ error: "アクセス権限がありません" }, { status: 403 });
    }

    // 既読に更新
    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        isRead: true,
        readAt: new Date(),
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
      data: updatedMessage,
    });
  } catch (error) {
    console.error("Message update error:", error);
    return NextResponse.json({ error: "メッセージの更新に失敗しました" }, { status: 500 });
  }
}
