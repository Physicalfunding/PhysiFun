import { OwnerEntry } from "@/domain/entry/entities/OwnerEntry";
import { OwnerEntryRepository } from "@/domain/entry/repositories/OwnerEntryRepository";
import { EntryId } from "@/domain/entry/value-objects/EntryId";
import { type Result, type AppError, ok } from "@/domain/shared/result";

/**
 * オーナー応募作成ユースケースの入力データ
 */
export interface CreateOwnerEntryInput {
  name: string;
  email: string;
  projectTitle: string;
  projectSummary: string;
  projectStory: string;
}

/**
 * CreateOwnerEntryUseCase
 * 新規オーナー応募を処理するユースケース
 *
 * 責務:
 * - 応募データのバリデーション（エンティティで実施）
 * - 応募の永続化
 */
export class CreateOwnerEntryUseCase {
  constructor(
    private readonly ownerEntryRepository: OwnerEntryRepository
  ) {}

  /**
   * オーナー応募を作成
   * @param input 応募情報
   * @returns 作成された応募、またはエラー
   */
  async execute(
    input: CreateOwnerEntryInput
  ): Promise<Result<OwnerEntry, AppError>> {
    // 1. エンティティの作成（バリデーション含む）
    const entryResult = OwnerEntry.create({
      id: EntryId.generate(),
      name: input.name,
      email: input.email,
      projectTitle: input.projectTitle,
      projectSummary: input.projectSummary,
      projectStory: input.projectStory,
    });

    if (!entryResult.success) {
      return entryResult;
    }

    // 2. 応募の永続化
    const createdEntry = await this.ownerEntryRepository.create(
      entryResult.data
    );

    return ok(createdEntry);
  }
}
