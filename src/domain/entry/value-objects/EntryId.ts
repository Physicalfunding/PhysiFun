import { randomUUID } from "crypto";

/**
 * EntryId 値オブジェクト
 * オーナー応募の一意識別子
 */
export class EntryId {
  private constructor(private readonly value: string) {}

  static generate(): EntryId {
    return new EntryId(randomUUID());
  }

  static from(value: string): EntryId {
    return new EntryId(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: EntryId): boolean {
    return this.value === other.value;
  }
}
