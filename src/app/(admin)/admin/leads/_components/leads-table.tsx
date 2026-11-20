"use client";

import type { ReactNode } from "react";
import { Mail, Send } from "lucide-react";
import { DataTable } from "@/components/admin/data-table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatRub,
  LEAD_STATUS_BADGE_CLASSES,
  LEAD_STATUS_LABELS,
  LEAD_TYPE_LABELS,
} from "../_lib/labels";
import type { LeadRow, NotifyState } from "../_queries";
import type { ColumnDef } from "@tanstack/react-table";

const NOTIFY_CLASSES: Record<NotifyState, string> = {
  ok: "text-green-600 dark:text-green-400",
  error: "text-red-600 dark:text-red-400",
  skipped: "text-muted-foreground",
  none: "text-muted-foreground/50",
};

const NOTIFY_TEXT: Record<NotifyState, string> = {
  ok: "отправлено",
  error: "ошибка",
  skipped: "пропущено (не настроено)",
  none: "не отправлялось",
};

/** Новые заявки выделяются жирным во всех ячейках строки */
function Cell({
  row,
  children,
  className,
}: {
  row: LeadRow;
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn(row.status === "new" && "font-semibold", className)}>{children}</span>;
}

function NotifyIcons({ notify }: { notify: LeadRow["notify"] }) {
  const label = `Email: ${NOTIFY_TEXT[notify.email]}, Telegram: ${NOTIFY_TEXT[notify.telegram]}`;
  return (
    <span className="inline-flex items-center gap-2" title={label} aria-label={label} role="img">
      <Mail className={cn("h-4 w-4", NOTIFY_CLASSES[notify.email])} aria-hidden />
      <Send className={cn("h-4 w-4", NOTIFY_CLASSES[notify.telegram])} aria-hidden />
    </span>
  );
}

// Сортировка и пагинация — на сервере: клиентская сортировка одной страницы вводила бы в заблуждение
const columns: ColumnDef<LeadRow, unknown>[] = [
  {
    id: "number",
    header: "№",
    enableSorting: false,
    cell: ({ row }) => (
      <Cell row={row.original} className="tabular-nums">
        #{row.original.number}
      </Cell>
    ),
  },
  {
    id: "createdAt",
    header: "Дата",
    enableSorting: false,
    cell: ({ row }) => (
      <Cell row={row.original} className="whitespace-nowrap tabular-nums">
        <time dateTime={row.original.createdAt}>{row.original.createdAtLabel}</time>
      </Cell>
    ),
  },
  {
    id: "type",
    header: "Тип",
    enableSorting: false,
    cell: ({ row }) => (
      <Badge variant="secondary" className="whitespace-nowrap">
        {LEAD_TYPE_LABELS[row.original.type]}
      </Badge>
    ),
  },
  {
    id: "sourceBlock",
    header: "Блок",
    enableSorting: false,
    cell: ({ row }) => (
      <Cell row={row.original} className="block max-w-48 truncate">
        {row.original.sourceBlock}
      </Cell>
    ),
  },
  {
    id: "name",
    header: "Имя",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.anonymized ? (
        <span className="text-muted-foreground">обезличено</span>
      ) : (
        <Cell row={row.original} className="block max-w-48 truncate">
          {row.original.name || "—"}
        </Cell>
      ),
  },
  {
    id: "phone",
    header: "Телефон",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.phone ? (
        <a
          href={`tel:${row.original.phone}`}
          className={cn(
            "text-primary whitespace-nowrap underline-offset-4 hover:underline",
            row.original.status === "new" && "font-semibold"
          )}
        >
          {row.original.phone}
        </a>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "guests",
    header: "Гостей",
    enableSorting: false,
    cell: ({ row }) => (
      <Cell row={row.original} className="tabular-nums">
        {row.original.guests ?? "—"}
      </Cell>
    ),
  },
  {
    id: "quoteTotal",
    header: "Сумма",
    enableSorting: false,
    cell: ({ row }) => (
      <Cell row={row.original} className="whitespace-nowrap tabular-nums">
        {row.original.quoteTotal === null ? "—" : formatRub(row.original.quoteTotal)}
      </Cell>
    ),
  },
  {
    id: "status",
    header: "Статус",
    enableSorting: false,
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={cn("whitespace-nowrap", LEAD_STATUS_BADGE_CLASSES[row.original.status])}
      >
        {LEAD_STATUS_LABELS[row.original.status]}
      </Badge>
    ),
  },
  {
    id: "notify",
    header: "Уведомления",
    enableSorting: false,
    cell: ({ row }) => <NotifyIcons notify={row.original.notify} />,
  },
];

type LeadsTableProps = { rows: LeadRow[]; emptyText: string };

export function LeadsTable({ rows, emptyText }: LeadsTableProps) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      // Страница уже отрезана сервером (по 50) — встроенная пагинация DataTable не нужна
      pageSize={Math.max(rows.length, 1)}
      getRowHref={(row) => `/admin/leads/${row.id}`}
      emptyText={emptyText}
    />
  );
}
