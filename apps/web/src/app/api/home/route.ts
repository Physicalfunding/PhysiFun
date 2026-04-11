/**
 * ホームページAPI
 * GET: ホームページ表示用プロジェクト取得
 */
import { NextRequest, NextResponse } from "next/server";
import { GetFeaturedProjectsUseCase } from "@/application/use-cases/guest/GetFeaturedProjectsUseCase";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";
import { prisma } from "@/infrastructure/database/prisma";
import { Category } from "@/domain/project/entities/Project";

const projectRepository = new PrismaProjectRepository(prisma);

/**
 * ホームページ用プロジェクト取得
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get("category") as Category | null;
    const location = searchParams.get("location");
    const limit = searchParams.get("limit");

    const useCase = new GetFeaturedProjectsUseCase(projectRepository);
    const result = await useCase.execute({
      category: category || undefined,
      location: location || undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("GET /api/home error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
