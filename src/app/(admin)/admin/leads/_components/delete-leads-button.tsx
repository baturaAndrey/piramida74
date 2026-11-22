"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/ui/button";
import { deleteLeads } from "../_actions";
import { deletedLeadsMessage, deleteLeadsTitle } from "../_lib/delete";

type DeleteLeadsButtonProps = {
  ids: string[];
  /** Текст кнопки-триггера */
  label: string;
  /** Куда перейти после удаления (страница заявки → список); без него — только refresh */
  redirectTo?: string;
  /** Например, сброс выбора в таблице */
  onDeleted?: () => void;
};

/** Кнопка «Удалить» с подтверждением; после удаления обновляет список и бейдж новых заявок. */
export function DeleteLeadsButton({ ids, label, redirectTo, onDeleted }: DeleteLeadsButtonProps) {
  const router = useRouter();

  async function handleConfirm() {
    const result = await deleteLeads({ ids });
    if (!result.ok) return result;
    toast.success(deletedLeadsMessage(result.data.deleted));
    onDeleted?.();
    if (redirectTo) router.replace(redirectTo);
    // Список без кэша и бейдж «новых» в сайдбаре (connection()) перечитываются сервером
    router.refresh();
    return result;
  }

  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="destructive" size="sm" disabled={ids.length === 0}>
          <Trash2 className="h-4 w-4" aria-hidden />
          {label}
        </Button>
      }
      title={deleteLeadsTitle(ids.length)}
      description={`Действие необратимо: вместе с ${ids.length === 1 ? "заявкой" : "заявками"} удаляются расчёты и история уведомлений.`}
      confirmLabel="Удалить"
      onConfirm={handleConfirm}
    />
  );
}
