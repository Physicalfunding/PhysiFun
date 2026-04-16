import { z } from "zod";
import { CATEGORY_MASTER, ProjectPhase } from "@physifun/domain";

const CATEGORY_VALUES = CATEGORY_MASTER.map((c) => c.value);

const PROJECT_PHASE_VALUES = Object.values(ProjectPhase) as [string, ...string[]];

const httpsUrl = z
  .string()
  .url("有効なURLを入力してください")
  .regex(/^https:\/\//, "https:// で始まるURLを入力してください");

/**
 * プロジェクト編集フォームの Zod スキーマ
 *
 * DRAFT 保存時は title のみ必須。
 * フィールド文字数上限は domain の LIMITS に合わせている。
 */
export const projectFormSchema = z.object({
  title: z.string().min(1, "タイトルは必須です").max(100, "タイトルは100文字以内です"),
  summary: z.string().max(300, "概要は300文字以内です").nullable().optional(),
  body: z.string().max(10000, "本文は10000文字以内です").nullable().optional(),
  leaderIntroduction: z.string().max(2000, "リーダー紹介は2000文字以内です").nullable().optional(),
  activityPlan: z.string().max(1000, "活動計画は1000文字以内です").nullable().optional(),
  coverImageUrl: httpsUrl.nullable().optional().or(z.literal("")),
  category: z
    .string()
    .refine((v) => CATEGORY_VALUES.includes(v as (typeof CATEGORY_VALUES)[number]), {
      message: "無効なカテゴリです",
    })
    .nullable()
    .optional(),
  prefectureCode: z
    .string()
    .regex(/^(?:0[1-9]|[1-3]\d|4[0-7])$/, "無効な都道府県コードです")
    .nullable()
    .optional()
    .or(z.literal("")),
  municipality: z.string().max(50, "市区町村は50文字以内です").nullable().optional(),
  phase: z.enum(PROJECT_PHASE_VALUES, { message: "無効なフェーズです" }).optional(),
  snsLinks: z
    .object({
      x: httpsUrl.max(500, "URLは500文字以内です").optional().or(z.literal("")),
      instagram: httpsUrl.max(500, "URLは500文字以内です").optional().or(z.literal("")),
      facebook: httpsUrl.max(500, "URLは500文字以内です").optional().or(z.literal("")),
      website: httpsUrl.max(500, "URLは500文字以内です").optional().or(z.literal("")),
    })
    .optional(),
});

export type ProjectFormValues = z.infer<typeof projectFormSchema>;
