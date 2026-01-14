/**
 * GetReturnsUseCase テスト
 * リターン一覧取得機能のユニットテスト
 */
import { GetReturnsUseCase } from "@/application/use-cases/return/GetReturnsUseCase";
import { Return } from "@/domain/project/entities/Return";
import { ProjectId } from "@/domain/project/value-objects/ProjectId";
import { ReturnId } from "@/domain/project/value-objects/ReturnId";

const mockReturnRepository = {
  findById: jest.fn(),
  findByProjectId: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  countByProjectId: jest.fn(),
  updateOrder: jest.fn(),
};

describe("GetReturnsUseCase", () => {
  let useCase: GetReturnsUseCase;
  let mockReturns: Return[];
  const projectId = ProjectId.generate();

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new GetReturnsUseCase(mockReturnRepository);

    mockReturns = [
      Return.reconstruct({
        id: ReturnId.generate(),
        projectId: projectId,
        name: "リターン1",
        description: "リターン1の説明",
        estimatedDeliveryDate: new Date("2025-06-01"),
        quantityLimit: 10,
        order: 0,
        createdAt: new Date(),
      }),
      Return.reconstruct({
        id: ReturnId.generate(),
        projectId: projectId,
        name: "リターン2",
        description: "リターン2の説明",
        estimatedDeliveryDate: null,
        quantityLimit: null,
        order: 1,
        createdAt: new Date(),
      }),
    ];
  });

  describe("正常系", () => {
    it("プロジェクトのリターン一覧を取得できる", async () => {
      // Arrange
      mockReturnRepository.findByProjectId.mockResolvedValue(mockReturns);

      // Act
      const result = await useCase.execute({
        projectId: projectId.value,
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.returns).toHaveLength(2);
        expect(result.data.returns[0].name).toBe("リターン1");
        expect(result.data.returns[1].name).toBe("リターン2");
      }
    });

    it("リターンがない場合は空配列を返す", async () => {
      // Arrange
      mockReturnRepository.findByProjectId.mockResolvedValue([]);

      // Act
      const result = await useCase.execute({
        projectId: projectId.value,
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.returns).toHaveLength(0);
      }
    });
  });

  describe("異常系", () => {
    it("無効なプロジェクトIDの場合エラーを返す", async () => {
      // Act
      const result = await useCase.execute({
        projectId: "invalid-uuid",
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });
});
