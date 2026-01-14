/**
 * プロジェクトリターンAPI
 * GET: リターン一覧取得
 * POST: リターン作成
 * PATCH: リターン順序変更
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CreateReturnUseCase } from "@/application/use-cases/return/CreateReturnUseCase";
import { GetReturnsUseCase } from "@/application/use-cases/return/GetReturnsUseCase";
import { ReorderReturnsUseCase } from "@/application/use-cases/return/ReorderReturnsUseCase";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";
import { PrismaReturnRepository } from "@/infrastructure/database/repositories/PrismaReturnRepository";
import { prisma } from "@/infrastructure/database/prisma";

const projectRepository = new PrismaProjectRepository(prisma);
const returnRepository = new PrismaReturnRepository(prisma);

/**
 * リターン一覧取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    const useCase = new GetReturnsUseCase(returnRepository);
    const result = await useCase.execute({ projectId });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message },
        { status: getStatusCode(result.error.code) }
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("GET /api/projects/[id]/returns error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * リターン作成
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: projectId } = await params;
    const body = await request.json();

    const useCase = new CreateReturnUseCase(projectRepository, returnRepository);
    const result = await useCase.execute({
      projectId,
      hostId: session.user.id,
      name: body.name,
      description: body.description,
      estimatedDeliveryDate: body.estimatedDeliveryDate ? new Date(body.estimatedDeliveryDate) : null,
      quantityLimit: body.quantityLimit ?? null,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message },
        { status: getStatusCode(result.error.code) }
      );
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    console.error("POST /api/projects/[id]/returns error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * リターン順序変更
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: projectId } = await params;
    const body = await request.json();

    const useCase = new ReorderReturnsUseCase(projectRepository, returnRepository);
    const result = await useCase.execute({
      projectId,
      hostId: session.user.id,
      orderedReturnIds: body.orderedReturnIds,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message },
        { status: getStatusCode(result.error.code) }
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("PATCH /api/projects/[id]/returns error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
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
