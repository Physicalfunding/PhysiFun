/**
 * 個別リターンAPI
 * PUT: リターン更新
 * DELETE: リターン削除
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UpdateReturnUseCase } from "@/application/use-cases/return/UpdateReturnUseCase";
import { DeleteReturnUseCase } from "@/application/use-cases/return/DeleteReturnUseCase";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";
import { PrismaReturnRepository } from "@/infrastructure/database/repositories/PrismaReturnRepository";
import { prisma } from "@/infrastructure/database/prisma";

const projectRepository = new PrismaProjectRepository(prisma);
const returnRepository = new PrismaReturnRepository(prisma);

/**
 * リターン更新
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; returnId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { returnId } = await params;
    const body = await request.json();

    const useCase = new UpdateReturnUseCase(projectRepository, returnRepository);
    const result = await useCase.execute({
      returnId,
      hostId: session.user.id,
      name: body.name,
      description: body.description,
      estimatedDeliveryDate:
        body.estimatedDeliveryDate !== undefined
          ? body.estimatedDeliveryDate
            ? new Date(body.estimatedDeliveryDate)
            : null
          : undefined,
      quantityLimit: body.quantityLimit,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message },
        { status: getStatusCode(result.error.code) }
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("PUT /api/projects/[id]/returns/[returnId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * リターン削除
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; returnId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { returnId } = await params;

    const useCase = new DeleteReturnUseCase(projectRepository, returnRepository);
    const result = await useCase.execute({
      returnId,
      hostId: session.user.id,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message },
        { status: getStatusCode(result.error.code) }
      );
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("DELETE /api/projects/[id]/returns/[returnId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function getStatusCode(code: string): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "FORBIDDEN":
      return 403;
    case "VALIDATION_ERROR":
      return 400;
    case "CONFLICT":
      return 409;
    default:
      return 500;
  }
}
