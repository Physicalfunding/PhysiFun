import { Participation, ParticipationStatus } from "@/domain/participation/entities/Participation";
import { ParticipationId } from "@/domain/participation/value-objects/ParticipationId";
import { UserId } from "@/domain/account/value-objects/UserId";
import { ScheduleId } from "@/domain/schedule/value-objects/ScheduleId";

describe("Participation", () => {
  const createValidGuestId = () => UserId.generate();
  const createValidScheduleId = () => ScheduleId.generate();
  const createValidParticipationId = () => ParticipationId.generate();

  describe("create", () => {
    it("should create a valid participation with PENDING status", () => {
      const result = Participation.create({
        id: createValidParticipationId(),
        guestId: createValidGuestId(),
        scheduleId: createValidScheduleId(),
        participantCount: 1,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.participantCount).toBe(1);
        expect(result.data.status).toBe(ParticipationStatus.PENDING);
        expect(result.data.appliedAt).toBeDefined();
      }
    });

    it("should create participation with multiple participants", () => {
      const result = Participation.create({
        id: createValidParticipationId(),
        guestId: createValidGuestId(),
        scheduleId: createValidScheduleId(),
        participantCount: 3,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.participantCount).toBe(3);
      }
    });

    it("should return error for zero participant count", () => {
      const result = Participation.create({
        id: createValidParticipationId(),
        guestId: createValidGuestId(),
        scheduleId: createValidScheduleId(),
        participantCount: 0,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("参加人数");
      }
    });

    it("should return error for negative participant count", () => {
      const result = Participation.create({
        id: createValidParticipationId(),
        guestId: createValidGuestId(),
        scheduleId: createValidScheduleId(),
        participantCount: -1,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });

  describe("confirm", () => {
    it("should confirm a pending participation", () => {
      const createResult = Participation.create({
        id: createValidParticipationId(),
        guestId: createValidGuestId(),
        scheduleId: createValidScheduleId(),
        participantCount: 1,
      });

      if (!createResult.success) throw new Error("Failed to create participation");

      const confirmResult = createResult.data.confirm();

      expect(confirmResult.success).toBe(true);
      if (confirmResult.success) {
        expect(confirmResult.data.status).toBe(ParticipationStatus.CONFIRMED);
      }
    });

    it("should return error when already confirmed", () => {
      const createResult = Participation.create({
        id: createValidParticipationId(),
        guestId: createValidGuestId(),
        scheduleId: createValidScheduleId(),
        participantCount: 1,
      });

      if (!createResult.success) throw new Error("Failed to create participation");

      const confirmResult = createResult.data.confirm();
      if (!confirmResult.success) throw new Error("Failed to confirm");

      const secondConfirmResult = confirmResult.data.confirm();

      expect(secondConfirmResult.success).toBe(false);
      if (!secondConfirmResult.success) {
        expect(secondConfirmResult.error.code).toBe("VALIDATION_ERROR");
        expect(secondConfirmResult.error.message).toContain("確認済み");
      }
    });
  });

  describe("cancel", () => {
    it("should cancel a pending participation", () => {
      const createResult = Participation.create({
        id: createValidParticipationId(),
        guestId: createValidGuestId(),
        scheduleId: createValidScheduleId(),
        participantCount: 1,
      });

      if (!createResult.success) throw new Error("Failed to create participation");

      const cancelResult = createResult.data.cancel();

      expect(cancelResult.success).toBe(true);
      if (cancelResult.success) {
        expect(cancelResult.data.status).toBe(ParticipationStatus.CANCELLED);
      }
    });

    it("should cancel a confirmed participation", () => {
      const createResult = Participation.create({
        id: createValidParticipationId(),
        guestId: createValidGuestId(),
        scheduleId: createValidScheduleId(),
        participantCount: 1,
      });

      if (!createResult.success) throw new Error("Failed to create participation");

      const confirmResult = createResult.data.confirm();
      if (!confirmResult.success) throw new Error("Failed to confirm");

      const cancelResult = confirmResult.data.cancel();

      expect(cancelResult.success).toBe(true);
      if (cancelResult.success) {
        expect(cancelResult.data.status).toBe(ParticipationStatus.CANCELLED);
      }
    });

    it("should return error when already cancelled", () => {
      const createResult = Participation.create({
        id: createValidParticipationId(),
        guestId: createValidGuestId(),
        scheduleId: createValidScheduleId(),
        participantCount: 1,
      });

      if (!createResult.success) throw new Error("Failed to create participation");

      const cancelResult = createResult.data.cancel();
      if (!cancelResult.success) throw new Error("Failed to cancel");

      const secondCancelResult = cancelResult.data.cancel();

      expect(secondCancelResult.success).toBe(false);
      if (!secondCancelResult.success) {
        expect(secondCancelResult.error.code).toBe("VALIDATION_ERROR");
        expect(secondCancelResult.error.message).toContain("キャンセル済み");
      }
    });
  });

  describe("isPending", () => {
    it("should return true for pending participation", () => {
      const createResult = Participation.create({
        id: createValidParticipationId(),
        guestId: createValidGuestId(),
        scheduleId: createValidScheduleId(),
        participantCount: 1,
      });

      if (!createResult.success) throw new Error("Failed to create participation");

      expect(createResult.data.isPending()).toBe(true);
    });

    it("should return false for confirmed participation", () => {
      const createResult = Participation.create({
        id: createValidParticipationId(),
        guestId: createValidGuestId(),
        scheduleId: createValidScheduleId(),
        participantCount: 1,
      });

      if (!createResult.success) throw new Error("Failed to create participation");

      const confirmResult = createResult.data.confirm();
      if (!confirmResult.success) throw new Error("Failed to confirm");

      expect(confirmResult.data.isPending()).toBe(false);
    });
  });

  describe("isActive", () => {
    it("should return true for pending participation", () => {
      const createResult = Participation.create({
        id: createValidParticipationId(),
        guestId: createValidGuestId(),
        scheduleId: createValidScheduleId(),
        participantCount: 1,
      });

      if (!createResult.success) throw new Error("Failed to create participation");

      expect(createResult.data.isActive()).toBe(true);
    });

    it("should return true for confirmed participation", () => {
      const createResult = Participation.create({
        id: createValidParticipationId(),
        guestId: createValidGuestId(),
        scheduleId: createValidScheduleId(),
        participantCount: 1,
      });

      if (!createResult.success) throw new Error("Failed to create participation");

      const confirmResult = createResult.data.confirm();
      if (!confirmResult.success) throw new Error("Failed to confirm");

      expect(confirmResult.data.isActive()).toBe(true);
    });

    it("should return false for cancelled participation", () => {
      const createResult = Participation.create({
        id: createValidParticipationId(),
        guestId: createValidGuestId(),
        scheduleId: createValidScheduleId(),
        participantCount: 1,
      });

      if (!createResult.success) throw new Error("Failed to create participation");

      const cancelResult = createResult.data.cancel();
      if (!cancelResult.success) throw new Error("Failed to cancel");

      expect(cancelResult.data.isActive()).toBe(false);
    });
  });

  describe("reconstruct", () => {
    it("should reconstruct a participation from persisted data", () => {
      const id = createValidParticipationId();
      const guestId = createValidGuestId();
      const scheduleId = createValidScheduleId();
      const appliedAt = new Date();
      const now = new Date();

      const participation = Participation.reconstruct({
        id,
        guestId,
        scheduleId,
        participantCount: 2,
        status: ParticipationStatus.CONFIRMED,
        appliedAt,
        createdAt: now,
        updatedAt: now,
      });

      expect(participation.id.value).toBe(id.value);
      expect(participation.guestId.value).toBe(guestId.value);
      expect(participation.scheduleId.value).toBe(scheduleId.value);
      expect(participation.participantCount).toBe(2);
      expect(participation.status).toBe(ParticipationStatus.CONFIRMED);
      expect(participation.appliedAt).toBe(appliedAt);
    });
  });
});
