/**
 * プロジェクト詳細API
 * GET: プロジェクト詳細取得
 */
import { NextRequest, NextResponse } from "next/server";
import { GetProjectDetailUseCase } from "@/application/use-cases/guest/GetProjectDetailUseCase";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";
import { PrismaReturnRepository } from "@/infrastructure/database/repositories/PrismaReturnRepository";
import { PrismaScheduleRepository } from "@/infrastructure/database/repositories/PrismaScheduleRepository";
import { PrismaUserRepository } from "@/infrastructure/database/repositories/PrismaUserRepository";
import { prisma } from "@/infrastructure/database/prisma";

const projectRepository = new PrismaProjectRepository(prisma);
const returnRepository = new PrismaReturnRepository(prisma);
const scheduleRepository = new PrismaScheduleRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);

/**
 * プロジェクト詳細取得
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const slug = searchParams.get("slug");
    const projectId = searchParams.get("id");

    const useCase = new GetProjectDetailUseCase(
      projectRepository,
      returnRepository,
      scheduleRepository,
      userRepository
    );

    const result = await useCase.execute({
      slug: slug || undefined,
      projectId: projectId || undefined,
    });

    if (!result.success) {
      const status =
        result.error.code === "NOT_FOUND"
          ? 404
          : result.error.code === "VALIDATION_ERROR"
            ? 400
            : 500;
      return NextResponse.json({ error: result.error.message }, { status });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("GET /api/projects/detail error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
