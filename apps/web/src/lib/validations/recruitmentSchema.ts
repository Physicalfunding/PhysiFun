import { z } from "zod";
import { SUPPORT_RECRUITMENT_LIMITS } from "@physifun/domain";

/**
 * サポート募集（タイトル・説明）のフォームと API の Zod スキーマ
 *
 * 上限は domain の `SUPPORT_RECRUITMENT_LIMITS` に合わせる。前後の空白はドメインでも除くが、
 * 空白だけの入力をフォームで止めるため、ここでも除いてから数える。
 */
export const recruitmentSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "タイトルは必須です")
    .max(
      SUPPORT_RECRUITMENT_LIMITS.title,
      `タイトルは${SUPPORT_RECRUITMENT_LIMITS.title}文字以内です`
    ),
  description: z
    .string()
    .trim()
    .min(1, "説明は必須です")
    .max(
      SUPPORT_RECRUITMENT_LIMITS.description,
      `説明は${SUPPORT_RECRUITMENT_LIMITS.description}文字以内です`
    ),
});

export type RecruitmentFormValues = z.infer<typeof recruitmentSchema>;
