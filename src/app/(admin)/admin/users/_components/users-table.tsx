"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DataTable } from "@/components/admin/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PANEL_LEVEL_LABELS } from "@/lib/roles";
import { deletePanelUser } from "../_actions";
import { ResetPasswordDialog } from "./reset-password-dialog";
import type { PanelUserRow } from "../_queries";
import type { ColumnDef } from "@tanstack/react-table";

type UsersTableProps = {
  rows: PanelUserRow[];
  currentUserId: string;
  /** Главных админов в списке: последнего удалить нельзя (сервер проверяет то же) */
  ownerCount: number;
};

function DeleteUserButton({ row }: { row: PanelUserRow }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          aria-label={`Удалить пользователя ${row.email}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          <span className="hidden lg:inline">Удалить</span>
        </Button>
      }
      title={`Удалить пользователя ${row.name || row.email}?`}
      description="Доступ в админку будет закрыт сразу: все сеансы пользователя завершатся. Действие необратимо."
      onConfirm={async () => {
        const result = await deletePanelUser({ userId: row.id });
        if (!result.ok) return result;
        toast.success("Пользователь удалён");
        router.refresh();
        return result;
      }}
    />
  );
}

function buildColumns(
  currentUserId: string,
  ownerCount: number
): ColumnDef<PanelUserRow, unknown>[] {
  return [
    {
      accessorKey: "name",
      header: "Имя",
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.name || "—"}
          {row.original.id === currentUserId ? (
            <span className="text-subtle font-normal"> (вы)</span>
          ) : null}
        </span>
      ),
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => <span className="break-all">{row.original.email}</span>,
    },
    {
      accessorKey: "level",
      header: "Уровень",
      cell: ({ row }) => (
        <Badge
          variant={row.original.level === "owner" ? "default" : "secondary"}
          className="whitespace-nowrap"
        >
          {PANEL_LEVEL_LABELS[row.original.level]}
        </Badge>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Создан",
      cell: ({ row }) => (
        <time dateTime={row.original.createdAt} className="whitespace-nowrap tabular-nums">
          {row.original.createdAtLabel}
        </time>
      ),
    },
    {
      accessorKey: "lastSignInAt",
      header: "Активный сеанс с",
      cell: ({ row }) =>
        row.original.lastSignInAt ? (
          <time dateTime={row.original.lastSignInAt} className="whitespace-nowrap tabular-nums">
            {row.original.lastSignInLabel}
          </time>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "status",
      header: "Статус",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="flex flex-wrap gap-1">
          {row.original.mustChangePassword ? (
            <Badge
              variant="outline"
              className="bg-badge text-badge-foreground border-transparent whitespace-nowrap"
            >
              Временный пароль
            </Badge>
          ) : null}
          {row.original.twoFactorEnabled ? (
            <Badge variant="outline" className="text-primary border-primary/40 whitespace-nowrap">
              2FA
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Действия</span>,
      enableSorting: false,
      cell: ({ row }) => {
        const isSelf = row.original.id === currentUserId;
        const isLastOwner = row.original.level === "owner" && ownerCount <= 1;
        const canDelete = !isSelf && !isLastOwner;
        return (
          <span className="flex items-center justify-end gap-1">
            {row.original.level === "staff" ? (
              <ResetPasswordDialog
                userId={row.original.id}
                name={row.original.name}
                email={row.original.email}
              />
            ) : null}
            {canDelete ? <DeleteUserButton row={row.original} /> : null}
          </span>
        );
      },
    },
  ];
}

export function UsersTable({ rows, currentUserId, ownerCount }: UsersTableProps) {
  return (
    <DataTable
      columns={buildColumns(currentUserId, ownerCount)}
      data={rows}
      emptyText="Пользователей пока нет"
    />
  );
}
