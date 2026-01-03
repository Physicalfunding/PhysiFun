import { Schedule } from "./Schedule";
import { ScheduleId } from "../value-objects/ScheduleId";
import { ProjectId } from "../../project/value-objects/ProjectId";

describe("Schedule", () => {
  const createValidProjectId = () => ProjectId.generate();
  const createValidScheduleId = () => ScheduleId.generate();
  const createFutureDate = () => new Date(Date.now() + 24 * 60 * 60 * 1000); // 1日後
  const createPastDate = () => new Date(Date.now() - 24 * 60 * 60 * 1000); // 1日前

  describe("create", () => {
    it("should create a valid schedule", () => {
      const futureDate = createFutureDate();
      const result = Schedule.create({
        id: createValidScheduleId(),
        projectId: createValidProjectId(),
        title: "古民家再生体験",
        description: "古民家の壁塗り体験をします",
        startDateTime: futureDate,
        capacity: 10,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("古民家再生体験");
        expect(result.data.description).toBe("古民家の壁塗り体験をします");
        expect(result.data.startDateTime).toEqual(futureDate);
        expect(result.data.capacity).toBe(10);
        expect(result.data.duration).toBeNull();
        expect(result.data.requirements).toBeNull();
      }
    });

    it("should create schedule with optional duration and requirements", () => {
      const result = Schedule.create({
        id: createValidScheduleId(),
        projectId: createValidProjectId(),
        title: "体験タイトル",
        description: "体験の説明",
        startDateTime: createFutureDate(),
        capacity: 5,
        duration: 120,
        requirements: "動きやすい服装でお越しください",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.duration).toBe(120);
        expect(result.data.requirements).toBe("動きやすい服装でお越しください");
      }
    });

    it("should return error for empty title", () => {
      const result = Schedule.create({
        id: createValidScheduleId(),
        projectId: createValidProjectId(),
        title: "",
        description: "説明",
        startDateTime: createFutureDate(),
        capacity: 5,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("タイトル");
      }
    });

    it("should return error for empty description", () => {
      const result = Schedule.create({
        id: createValidScheduleId(),
        projectId: createValidProjectId(),
        title: "タイトル",
        description: "",
        startDateTime: createFutureDate(),
        capacity: 5,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("体験内容");
      }
    });

    it("should return error for past start date", () => {
      const result = Schedule.create({
        id: createValidScheduleId(),
        projectId: createValidProjectId(),
        title: "タイトル",
        description: "説明",
        startDateTime: createPastDate(),
        capacity: 5,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("未来");
      }
    });

    it("should return error for zero capacity", () => {
      const result = Schedule.create({
        id: createValidScheduleId(),
        projectId: createValidProjectId(),
        title: "タイトル",
        description: "説明",
        startDateTime: createFutureDate(),
        capacity: 0,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("募集人数");
      }
    });

    it("should return error for negative capacity", () => {
      const result = Schedule.create({
        id: createValidScheduleId(),
        projectId: createValidProjectId(),
        title: "タイトル",
        description: "説明",
        startDateTime: createFutureDate(),
        capacity: -5,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });

  describe("update", () => {
    it("should update schedule information", () => {
      const createResult = Schedule.create({
        id: createValidScheduleId(),
        projectId: createValidProjectId(),
        title: "元のタイトル",
        description: "元の説明",
        startDateTime: createFutureDate(),
        capacity: 5,
      });

      if (!createResult.success) throw new Error("Failed to create schedule");

      const newDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const updateResult = createResult.data.update({
        title: "新しいタイトル",
        startDateTime: newDate,
        capacity: 10,
      });

      expect(updateResult.success).toBe(true);
      if (updateResult.success) {
        expect(updateResult.data.title).toBe("新しいタイトル");
        expect(updateResult.data.startDateTime).toEqual(newDate);
        expect(updateResult.data.capacity).toBe(10);
        expect(updateResult.data.description).toBe("元の説明");
      }
    });

    it("should return error for empty title in update", () => {
      const createResult = Schedule.create({
        id: createValidScheduleId(),
        projectId: createValidProjectId(),
        title: "タイトル",
        description: "説明",
        startDateTime: createFutureDate(),
        capacity: 5,
      });

      if (!createResult.success) throw new Error("Failed to create schedule");

      const updateResult = createResult.data.update({ title: "" });

      expect(updateResult.success).toBe(false);
    });

    it("should return error for past date in update", () => {
      const createResult = Schedule.create({
        id: createValidScheduleId(),
        projectId: createValidProjectId(),
        title: "タイトル",
        description: "説明",
        startDateTime: createFutureDate(),
        capacity: 5,
      });

      if (!createResult.success) throw new Error("Failed to create schedule");

      const updateResult = createResult.data.update({ startDateTime: createPastDate() });

      expect(updateResult.success).toBe(false);
    });
  });

  describe("hasCapacity", () => {
    it("should return true when there is capacity", () => {
      const createResult = Schedule.create({
        id: createValidScheduleId(),
        projectId: createValidProjectId(),
        title: "タイトル",
        description: "説明",
        startDateTime: createFutureDate(),
        capacity: 10,
      });

      if (!createResult.success) throw new Error("Failed to create schedule");

      expect(createResult.data.hasCapacity(5)).toBe(true);
    });

    it("should return true when exactly at capacity", () => {
      const createResult = Schedule.create({
        id: createValidScheduleId(),
        projectId: createValidProjectId(),
        title: "タイトル",
        description: "説明",
        startDateTime: createFutureDate(),
        capacity: 10,
      });

      if (!createResult.success) throw new Error("Failed to create schedule");

      expect(createResult.data.hasCapacity(10)).toBe(true);
    });

    it("should return false when over capacity", () => {
      const createResult = Schedule.create({
        id: createValidScheduleId(),
        projectId: createValidProjectId(),
        title: "タイトル",
        description: "説明",
        startDateTime: createFutureDate(),
        capacity: 10,
      });

      if (!createResult.success) throw new Error("Failed to create schedule");

      expect(createResult.data.hasCapacity(11)).toBe(false);
    });
  });

  describe("isPast", () => {
    it("should return false for future schedule", () => {
      const createResult = Schedule.create({
        id: createValidScheduleId(),
        projectId: createValidProjectId(),
        title: "タイトル",
        description: "説明",
        startDateTime: createFutureDate(),
        capacity: 5,
      });

      if (!createResult.success) throw new Error("Failed to create schedule");

      expect(createResult.data.isPast()).toBe(false);
    });
  });

  describe("reconstruct", () => {
    it("should reconstruct a schedule from persisted data", () => {
      const id = createValidScheduleId();
      const projectId = createValidProjectId();
      const startDateTime = createFutureDate();
      const now = new Date();

      const schedule = Schedule.reconstruct({
        id,
        projectId,
        title: "再構築スケジュール",
        description: "説明",
        startDateTime,
        duration: 180,
        capacity: 15,
        requirements: "持ち物",
        createdAt: now,
        updatedAt: now,
      });

      expect(schedule.id.value).toBe(id.value);
      expect(schedule.projectId.value).toBe(projectId.value);
      expect(schedule.title).toBe("再構築スケジュール");
      expect(schedule.duration).toBe(180);
      expect(schedule.capacity).toBe(15);
      expect(schedule.requirements).toBe("持ち物");
    });
  });
});
