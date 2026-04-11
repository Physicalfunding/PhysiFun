import "@testing-library/jest-dom";
import { randomUUID } from "crypto";

// crypto.randomUUIDのポリフィル（Node.js環境用）
// jsdom環境ではglobal.cryptoが存在しないためポリフィルが必要
if (typeof globalThis.crypto === "undefined") {
  // @ts-expect-error - jsdom環境でcrypto APIをモック
  globalThis.crypto = { randomUUID };
} else if (typeof globalThis.crypto.randomUUID === "undefined") {
  globalThis.crypto.randomUUID = randomUUID;
}
