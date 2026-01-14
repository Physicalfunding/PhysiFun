import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/infrastructure/database/prisma";
import { authOptions } from "@/lib/auth";

/**
 * POST /api/messages/reply
 * メッセージに返信する
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const body = await request.json();
    const { parentMessageId, receiverId, body: messageBody } = body;

    // バリデーション
    if (!parentMessageId) {
      return NextResponse.json({ error: "返信先メッセージIDは必須です" }, { status: 400 });
    }

    if (!receiverId) {
      return NextResponse.json({ error: "受信者IDは必須です" }, { status: 400 });
    }

    if (!messageBody || messageBody.trim() === "") {
      return NextResponse.json({ error: "本文は必須です" }, { status: 400 });
    }

    // 自分自身への返信を禁止
    if (session.user.id === receiverId) {
      return NextResponse.json(
        { error: "自分自身にメッセージを送信することはできません" },
        { status: 400 }
      );
    }

    // 親メッセージを取得
    const parentMessage = await prisma.message.findUnique({
      where: { id: parentMessageId },
    });

    if (!parentMessage) {
      return NextResponse.json({ error: "返信先メッセージが見つかりません" }, { status: 404 });
    }

    // 親メッセージの送信者または受信者のみ返信可能
    if (
      parentMessage.senderId !== session.user.id &&
      parentMessage.receiverId !== session.user.id
    ) {
      return NextResponse.json(
        { error: "このメッセージに返信する権限がありません" },
        { status: 403 }
      );
    }

    // スレッドのルートメッセージIDを取得
    const rootMessageId = parentMessage.parentMessageId || parentMessage.id;

    // 件名を設定（Re: を付ける）
    const subject = parentMessage.subject.startsWith("Re: ")
      ? parentMessage.subject
      : `Re: ${parentMessage.subject}`;

    // 返信メッセージを作成
    const replyMessage = await prisma.message.create({
      data: {
        senderId: session.user.id,
        receiverId,
        subject,
        body: messageBody.trim(),
        isRead: false,
        parentMessageId: rootMessageId,
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
      data: replyMessage,
    });
  } catch (error) {
    console.error("Reply message error:", error);
    return NextResponse.json({ error: "返信の送信に失敗しました" }, { status: 500 });
  }
}
