import { Return } from "./Return";
import { ReturnId } from "../value-objects/ReturnId";
import { ProjectId } from "../value-objects/ProjectId";

describe("Return", () => {
  const createValidProjectId = () => ProjectId.generate();
  const createValidReturnId = () => ReturnId.generate();

  describe("create", () => {
    it("should create a valid return", () => {
      const result = Return.create({
        id: createValidReturnId(),
        projectId: createValidProjectId(),
        name: "収穫した野菜セット",
        description: "体験で収穫した野菜をお持ち帰りいただけます",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("収穫した野菜セット");
        expect(result.data.description).toBe("体験で収穫した野菜をお持ち帰りいただけます");
        expect(result.data.estimatedDeliveryDate).toBeNull();
        expect(result.data.quantityLimit).toBeNull();
        expect(result.data.order).toBe(0);
      }
    });

    it("should create return with optional estimated delivery date", () => {
      const deliveryDate = new Date("2026-03-01");
      const result = Return.create({
        id: createValidReturnId(),
        projectId: createValidProjectId(),
        name: "リターン名",
        description: "説明",
        estimatedDeliveryDate: deliveryDate,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.estimatedDeliveryDate).toEqual(deliveryDate);
      }
    });

    it("should create return with optional quantity limit", () => {
      const result = Return.create({
        id: createValidReturnId(),
        projectId: createValidProjectId(),
        name: "限定リターン",
        description: "数量限定のリターンです",
        quantityLimit: 10,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.quantityLimit).toBe(10);
      }
    });

    it("should create return with order", () => {
      const result = Return.create({
        id: createValidReturnId(),
        projectId: createValidProjectId(),
        name: "リターン",
        description: "説明",
        order: 3,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.order).toBe(3);
      }
    });

    it("should return error for empty name", () => {
      const result = Return.create({
        id: createValidReturnId(),
        projectId: createValidProjectId(),
        name: "",
        description: "説明",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("リターン名");
      }
    });

    it("should return error for empty description", () => {
      const result = Return.create({
        id: createValidReturnId(),
        projectId: createValidProjectId(),
        name: "リターン名",
        description: "",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("説明");
      }
    });
  });

  describe("update", () => {
    it("should update return information", () => {
      const createResult = Return.create({
        id: createValidReturnId(),
        projectId: createValidProjectId(),
        name: "元のリターン名",
        description: "元の説明",
      });

      if (!createResult.success) throw new Error("Failed to create return");

      const updateResult = createResult.data.update({
        name: "新しいリターン名",
        quantityLimit: 5,
      });

      expect(updateResult.success).toBe(true);
      if (updateResult.success) {
        expect(updateResult.data.name).toBe("新しいリターン名");
        expect(updateResult.data.quantityLimit).toBe(5);
        expect(updateResult.data.description).toBe("元の説明");
      }
    });

    it("should return error for empty name in update", () => {
      const createResult = Return.create({
        id: createValidReturnId(),
        projectId: createValidProjectId(),
        name: "リターン名",
        description: "説明",
      });

      if (!createResult.success) throw new Error("Failed to create return");

      const updateResult = createResult.data.update({ name: "" });

      expect(updateResult.success).toBe(false);
    });
  });

  describe("hasQuantityLimit", () => {
    it("should return false when no quantity limit", () => {
      const createResult = Return.create({
        id: createValidReturnId(),
        projectId: createValidProjectId(),
        name: "リターン",
        description: "説明",
      });

      if (!createResult.success) throw new Error("Failed to create return");

      expect(createResult.data.hasQuantityLimit()).toBe(false);
    });

    it("should return true when quantity limit exists", () => {
      const createResult = Return.create({
        id: createValidReturnId(),
        projectId: createValidProjectId(),
        name: "リターン",
        description: "説明",
        quantityLimit: 10,
      });

      if (!createResult.success) throw new Error("Failed to create return");

      expect(createResult.data.hasQuantityLimit()).toBe(true);
    });
  });

  describe("reconstruct", () => {
    it("should reconstruct a return from persisted data", () => {
      const id = createValidReturnId();
      const projectId = createValidProjectId();
      const deliveryDate = new Date("2026-06-01");
      const now = new Date();

      const returnItem = Return.reconstruct({
        id,
        projectId,
        name: "再構築リターン",
        description: "説明",
        estimatedDeliveryDate: deliveryDate,
        quantityLimit: 20,
        order: 2,
        createdAt: now,
      });

      expect(returnItem.id.value).toBe(id.value);
      expect(returnItem.projectId.value).toBe(projectId.value);
      expect(returnItem.name).toBe("再構築リターン");
      expect(returnItem.estimatedDeliveryDate).toEqual(deliveryDate);
      expect(returnItem.quantityLimit).toBe(20);
      expect(returnItem.order).toBe(2);
    });
  });
});
