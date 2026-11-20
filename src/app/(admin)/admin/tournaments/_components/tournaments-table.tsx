"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Copy, Layers, Loader2, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DataTable } from "@/components/admin/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatEventDate } from "@/lib/dates";
import { deleteTournament, togglePublishTournament } from "../_actions";
import {
  DISCIPLINE_LABELS,
  LEVEL_LABELS,
  parseWhen,
  WHEN_OPTIONS,
  type TournamentsWhen,
} from "../_lib/labels";
import type { TournamentRow } from "../_queries";
import type { ColumnDef } from "@tanstack/react-table";

type TournamentsTableProps = {
  rows: TournamentRow[];
  years: number[];
  when: TournamentsWhen;
  year: number | null;
  q: string;
};

const ALL_YEARS = "all";
const SEARCH_DEBOUNCE_MS = 400;
const EMPTY_TEXT = "Турниров нет. Создайте первый или продублируйте прошлый тур";

/** Мгновенная публикация/снятие с оптимистичным состоянием и откатом при ошибке. */
function PublishSwitch({ row }: { row: TournamentRow }) {
  const [checked, setChecked] = useState(row.isPublished);
  const [synced, setSynced] = useState(row.isPublished);
  const [pending, setPending] = useState(false);

  // Данные с сервера изменились (после revalidate) — принимаем их
  if (row.isPublished !== synced) {
    setSynced(row.isPublished);
    setChecked(row.isPublished);
  }

  async function toggle(value: boolean) {
    setChecked(value);
    setPending(true);
    const res = await togglePublishTournament({ id: row.id, value });
    setPending(false);
    if (!res.ok) {
      setChecked(!value);
      toast.error(res.error);
      return;
    }
    toast.success(value ? "Турнир опубликован" : "Турнир снят с публикации");
  }

  return (
    <Switch
      checked={checked}
      disabled={pending}
      aria-label={checked ? "Снять с публикации" : "Опубликовать"}
      onCheckedChange={(value) => void toggle(value)}
    />
  );
}

function RowActions({ row }: { row: TournamentRow }) {
  return (
    // Меню и диалог рендерятся в порталах, но React-события всплывают по дереву компонентов —
    // гасим клики здесь, чтобы они не открывали карточку турнира через клик по строке
    <div onClick={(event) => event.stopPropagation()}>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label="Действия">
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/admin/tournaments/${row.id}`}>
              <Pencil className="h-4 w-4" aria-hidden />
              Редактировать
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/admin/tournaments/new?from=${row.id}`}>
              <Copy className="h-4 w-4" aria-hidden />
              Дублировать
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <ConfirmDialog
            trigger={
              <DropdownMenuItem
                variant="destructive"
                // Не закрываем меню по выбору — иначе вместе с ним размонтируется диалог
                onSelect={(event) => event.preventDefault()}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Удалить
              </DropdownMenuItem>
            }
            title={`Удалить турнир «${row.title}»?`}
            description="Действие необратимо."
            onConfirm={async () => {
              const res = await deleteTournament({ id: row.id });
              if (res.ok) toast.success("Турнир удалён");
              return res;
            }}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const columns: ColumnDef<TournamentRow, unknown>[] = [
  {
    id: "dates",
    accessorKey: "startDate",
    header: "Даты",
    cell: ({ row }) => (
      <div className="whitespace-nowrap">
        {formatEventDate(row.original.startDate, row.original.endDate)}{" "}
        <span className="text-muted-foreground">{row.original.startDate.slice(0, 4)}</span>
      </div>
    ),
  },
  {
    accessorKey: "title",
    header: "Название",
    cell: ({ row }) => (
      <div className="min-w-48 space-y-1">
        <Link
          href={`/admin/tournaments/${row.original.id}`}
          className="font-medium hover:underline"
        >
          {row.original.title}
        </Link>
        {row.original.seriesName ? (
          <div className="flex flex-wrap gap-1">
            <Badge variant="secondary">{row.original.seriesName}</Badge>
            {row.original.stageNumber ? (
              <Badge variant="outline">{row.original.stageNumber} тур</Badge>
            ) : null}
          </div>
        ) : null}
      </div>
    ),
  },
  {
    accessorKey: "discipline",
    header: "Дисциплина",
    cell: ({ row }) =>
      row.original.discipline ? (
        DISCIPLINE_LABELS[row.original.discipline]
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: "level",
    header: "Уровень",
    cell: ({ row }) => LEVEL_LABELS[row.original.level],
  },
  {
    accessorKey: "isPublished",
    header: "Опубликован",
    enableSorting: false,
    cell: ({ row }) => <PublishSwitch row={row.original} />,
  },
  {
    accessorKey: "registrationOpen",
    header: "Регистрация",
    enableSorting: false,
    cell: ({ row }) => (row.original.registrationOpen ? <Badge>открыта</Badge> : null),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Действия</span>,
    enableSorting: false,
    cell: ({ row }) => <RowActions row={row.original} />,
  },
];

export function TournamentsTable({ rows, years, when, year, q }: TournamentsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(q);
  const lastPushedQ = useRef(q);

  function updateParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  // Поиск по названию — с задержкой, чтобы не дёргать сервер на каждую букву
  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed === lastPushedQ.current) return;
    const timer = window.setTimeout(() => {
      lastPushedQ.current = trimmed;
      updateParams({ q: trimmed || null });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // updateParams пересоздаётся на каждый рендер; зависим только от текста поиска
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <Tabs
          value={when}
          onValueChange={(value) =>
            updateParams({ when: parseWhen(value) === "upcoming" ? null : value })
          }
        >
          <TabsList>
            {WHEN_OPTIONS.map((option) => (
              <TabsTrigger key={option.value} value={option.value}>
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            value={year ? String(year) : ALL_YEARS}
            disabled={when === "upcoming"}
            onValueChange={(value) => updateParams({ year: value === ALL_YEARS ? null : value })}
          >
            <SelectTrigger className="w-full sm:w-36" aria-label="Год">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_YEARS}>Все годы</SelectItem>
              {years.map((item) => (
                <SelectItem key={item} value={String(item)}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-64">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              type="search"
              value={search}
              placeholder="Поиск по названию"
              aria-label="Поиск по названию"
              className="pl-8"
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  const trimmed = search.trim();
                  lastPushedQ.current = trimmed;
                  updateParams({ q: trimmed || null });
                }
              }}
            />
          </div>
          {isPending ? (
            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" aria-label="Загрузка" />
          ) : null}
        </div>
        <div className="flex gap-2 lg:ml-auto">
          <Button asChild variant="outline">
            <Link href="/admin/tournaments/series">
              <Layers className="h-4 w-4" aria-hidden />
              Серии
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/tournaments/new">
              <Plus className="h-4 w-4" aria-hidden />
              Создать турнир
            </Link>
          </Button>
        </div>
      </div>
      <div className={isPending ? "opacity-60 transition-opacity" : "transition-opacity"}>
        <DataTable
          columns={columns}
          data={rows}
          pageSize={50}
          getRowHref={(row) => `/admin/tournaments/${row.id}`}
          emptyText={EMPTY_TEXT}
        />
      </div>
    </div>
  );
}
