import { randomUUID } from "crypto";

/**
 * ApplicationId 値オブジェクト
 * オーナー応募の一意識別子
 */
export class ApplicationId {
  private constructor(private readonly value: string) {}

  static generate(): ApplicationId {
    return new ApplicationId(randomUUID());
  }

  static from(value: string): ApplicationId {
    return new ApplicationId(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: ApplicationId): boolean {
    return this.value === other.value;
  }
}
