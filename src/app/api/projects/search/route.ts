/**
 * プロジェクト検索API
 * GET: プロジェクト検索
 */
import { NextRequest, NextResponse } from "next/server";
import { SearchProjectsUseCase } from "@/application/use-cases/guest/SearchProjectsUseCase";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";
import { prisma } from "@/infrastructure/database/prisma";
import { Category } from "@/domain/project/entities/Project";

const projectRepository = new PrismaProjectRepository(prisma);

/**
 * プロジェクト検索
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const keyword = searchParams.get("keyword");
    const category = searchParams.get("category") as Category | null;
    const location = searchParams.get("location");
    const page = searchParams.get("page");
    const limit = searchParams.get("limit");

    const useCase = new SearchProjectsUseCase(projectRepository);
    const result = await useCase.execute({
      keyword: keyword || undefined,
      category: category || undefined,
      location: location || undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("GET /api/projects/search error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
