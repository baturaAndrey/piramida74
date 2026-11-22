"use client";

import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { runActionCallback, type ActionCallback } from "./action-outcome";

export type ConfirmDialogProps = {
  /** Элемент-триггер (обычно `<Button>`); оборачивается в `AlertDialogTrigger asChild` */
  trigger: ReactNode;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /**
   * Действие подтверждения. Неуспех — исключение или результат `{ ok: false, error }`
   * (как у `adminAction`): диалог остаётся открытым, показывается toast с текстом ошибки.
   */
  onConfirm: ActionCallback;
};

const DEFAULT_ERROR = "Не удалось выполнить действие";

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Удалить",
  cancelLabel = "Отмена",
  destructive = true,
  onConfirm,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    setPending(true);
    const error = await runActionCallback(onConfirm, [], DEFAULT_ERROR);
    setPending(false);
    if (error) {
      toast.error(error);
      return;
    }
    setOpen(false);
  }

  return (
    <AlertDialog
      open={open}
      // Пока действие выполняется, диалог нельзя закрыть (Esc/клик по фону)
      onOpenChange={(next) => {
        if (!pending) setOpen(next);
      }}
    >
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          {/* Обычная кнопка вместо AlertDialogAction: Action закрывает диалог сразу, до завершения onConfirm */}
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            aria-busy={pending}
            onClick={handleConfirm}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
