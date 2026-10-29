"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SUPPORT_RECRUITMENT_LIMITS } from "@physifun/domain";
import { Button, Input, Modal, Textarea } from "@/components/common";
import { recruitmentSchema, type RecruitmentFormValues } from "@/lib/validations/recruitmentSchema";

interface RecruitmentFormModalProps {
  /** モーダルの見出し（「募集を作成」など） */
  heading: string;
  submitLabel: string;
  /** 編集のときの今の値。作成のときは省略する */
  defaultValues?: RecruitmentFormValues;
  onClose: () => void;
  /** 保存に成功したらモーダルを閉じるのは呼び出し側 */
  onSubmit: (values: RecruitmentFormValues) => Promise<void>;
}

/**
 * 募集（タイトル・説明）の作成・編集モーダル
 *
 * 開くたびに初期値から始めるため、呼び出し側は開いているときだけ描画する。
 */
export function RecruitmentFormModal({
  heading,
  submitLabel,
  defaultValues,
  onClose,
  onSubmit,
}: RecruitmentFormModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RecruitmentFormValues>({
    resolver: zodResolver(recruitmentSchema),
    defaultValues: defaultValues ?? { title: "", description: "" },
  });

  // 送信中は閉じない（閉じて別のモーダルを開くと、送信が終わった時点でそちらが閉じてしまう）
  const handleClose = () => {
    if (!isSubmitting) onClose();
  };

  return (
    <Modal isOpen onClose={handleClose} title={heading} size="lg">
      {/* ブラウザ標準の入力チェック（required）を止め、Zod のメッセージを項目の下に出す */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Input
          label="タイトル"
          required
          placeholder="例: 畑の草刈り"
          helperText={`${SUPPORT_RECRUITMENT_LIMITS.title}文字以内`}
          error={errors.title?.message}
          {...register("title")}
        />
        <Textarea
          label="説明"
          required
          rows={6}
          placeholder="どんな活動か、サポーターにお願いしたいことを書いてください"
          helperText={`${SUPPORT_RECRUITMENT_LIMITS.description}文字以内`}
          error={errors.description?.message}
          {...register("description")}
        />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            キャンセル
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
