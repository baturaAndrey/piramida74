"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "./confirm-dialog";
import type { ActionCallback } from "./action-outcome";

export type FormActionsProps = {
  isSubmitting?: boolean;
  submitLabel?: string;
  /** Ссылка «Отмена»; без неё кнопка не показывается */
  cancelHref?: string;
  /**
   * Удаление через `ConfirmDialog`; без обработчика кнопка не показывается.
   * Исключение или `{ ok: false, error }` оставляют диалог открытым и показывают toast.
   */
  onDelete?: ActionCallback;
  deleteLabel?: string;
  /** Текст подтверждения удаления */
  deleteDescription?: ReactNode;
  /** Дополнительные элементы между «Удалить» и «Отмена» */
  extra?: ReactNode;
};

/** Липкая нижняя панель формы: «Удалить» слева, «Отмена» и «Сохранить» справа. */
export function FormActions({
  isSubmitting = false,
  submitLabel = "Сохранить",
  cancelHref,
  onDelete,
  deleteLabel = "Удалить",
  deleteDescription = "Действие нельзя отменить.",
  extra,
}: FormActionsProps) {
  return (
    <div className="bg-background/95 sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
      {onDelete ? (
        <ConfirmDialog
          trigger={
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              {deleteLabel}
            </Button>
          }
          title={`${deleteLabel}?`}
          description={deleteDescription}
          confirmLabel={deleteLabel}
          onConfirm={onDelete}
        />
      ) : null}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {extra}
        {cancelHref ? (
          <Button asChild variant="outline">
            <Link href={cancelHref}>Отмена</Link>
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
