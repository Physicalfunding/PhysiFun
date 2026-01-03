import { Message } from "./Message";
import { MessageId } from "../value-objects/MessageId";
import { UserId } from "../../account/value-objects/UserId";

describe("Message", () => {
  const createValidSenderId = () => UserId.generate();
  const createValidReceiverId = () => UserId.generate();
  const createValidMessageId = () => MessageId.generate();

  describe("create", () => {
    it("should create a valid message", () => {
      const result = Message.create({
        id: createValidMessageId(),
        senderId: createValidSenderId(),
        receiverId: createValidReceiverId(),
        subject: "体験参加について質問があります",
        body: "当日の持ち物について教えてください。",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.subject).toBe("体験参加について質問があります");
        expect(result.data.body).toBe("当日の持ち物について教えてください。");
        expect(result.data.isRead).toBe(false);
        expect(result.data.parentMessageId).toBeNull();
        expect(result.data.readAt).toBeNull();
      }
    });

    it("should create a reply message", () => {
      const parentMessageId = createValidMessageId();
      const result = Message.create({
        id: createValidMessageId(),
        senderId: createValidSenderId(),
        receiverId: createValidReceiverId(),
        subject: "Re: 体験参加について質問があります",
        body: "長靴と軍手をご持参ください。",
        parentMessageId,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.parentMessageId?.value).toBe(parentMessageId.value);
      }
    });

    it("should return error for empty subject", () => {
      const result = Message.create({
        id: createValidMessageId(),
        senderId: createValidSenderId(),
        receiverId: createValidReceiverId(),
        subject: "",
        body: "本文",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("件名");
      }
    });

    it("should return error for empty body", () => {
      const result = Message.create({
        id: createValidMessageId(),
        senderId: createValidSenderId(),
        receiverId: createValidReceiverId(),
        subject: "件名",
        body: "",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("本文");
      }
    });

    it("should return error when sender and receiver are the same", () => {
      const userId = createValidSenderId();
      const result = Message.create({
        id: createValidMessageId(),
        senderId: userId,
        receiverId: userId,
        subject: "件名",
        body: "本文",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("自分自身");
      }
    });
  });

  describe("markAsRead", () => {
    it("should mark an unread message as read", () => {
      const createResult = Message.create({
        id: createValidMessageId(),
        senderId: createValidSenderId(),
        receiverId: createValidReceiverId(),
        subject: "件名",
        body: "本文",
      });

      if (!createResult.success) throw new Error("Failed to create message");

      const markedMessage = createResult.data.markAsRead();

      expect(markedMessage.isRead).toBe(true);
      expect(markedMessage.readAt).not.toBeNull();
    });

    it("should not change readAt when already read", () => {
      const createResult = Message.create({
        id: createValidMessageId(),
        senderId: createValidSenderId(),
        receiverId: createValidReceiverId(),
        subject: "件名",
        body: "本文",
      });

      if (!createResult.success) throw new Error("Failed to create message");

      const firstRead = createResult.data.markAsRead();
      const firstReadAt = firstRead.readAt;

      // Wait a tiny bit to ensure time difference
      const secondRead = firstRead.markAsRead();

      expect(secondRead.readAt).toEqual(firstReadAt);
    });
  });

  describe("isReply", () => {
    it("should return false for original message", () => {
      const createResult = Message.create({
        id: createValidMessageId(),
        senderId: createValidSenderId(),
        receiverId: createValidReceiverId(),
        subject: "件名",
        body: "本文",
      });

      if (!createResult.success) throw new Error("Failed to create message");

      expect(createResult.data.isReply()).toBe(false);
    });

    it("should return true for reply message", () => {
      const createResult = Message.create({
        id: createValidMessageId(),
        senderId: createValidSenderId(),
        receiverId: createValidReceiverId(),
        subject: "Re: 件名",
        body: "返信本文",
        parentMessageId: createValidMessageId(),
      });

      if (!createResult.success) throw new Error("Failed to create message");

      expect(createResult.data.isReply()).toBe(true);
    });
  });

  describe("reconstruct", () => {
    it("should reconstruct a message from persisted data", () => {
      const id = createValidMessageId();
      const senderId = createValidSenderId();
      const receiverId = createValidReceiverId();
      const now = new Date();
      const readAt = new Date();

      const message = Message.reconstruct({
        id,
        senderId,
        receiverId,
        subject: "再構築メッセージ",
        body: "本文",
        isRead: true,
        parentMessageId: null,
        createdAt: now,
        readAt,
      });

      expect(message.id.value).toBe(id.value);
      expect(message.senderId.value).toBe(senderId.value);
      expect(message.receiverId.value).toBe(receiverId.value);
      expect(message.subject).toBe("再構築メッセージ");
      expect(message.isRead).toBe(true);
      expect(message.readAt).toBe(readAt);
    });
  });
});
