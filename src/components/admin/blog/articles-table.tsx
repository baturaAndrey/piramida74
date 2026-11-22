"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, Loader2, MoreHorizontal, Pencil, Search, Star, Trash2 } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { deleteArticle } from "@/lib/actions/blog-articles";
import type { ArticleFilter, ArticleRow, EffectiveStatus } from "@/lib/blog-admin/queries";
import type { ColumnDef } from "@tanstack/react-table";

export type ArticlesTableProps = {
  rows: ArticleRow[];
  filter: ArticleFilter;
  q: string;
  page: number;
  pageCount: number;
  total: number;
};

const SEARCH_DEBOUNCE_MS = 400;

const FILTER_OPTIONS: { value: ArticleFilter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "draft", label: "Черновики" },
  { value: "scheduled", label: "Запланированные" },
  { value: "published", label: "Опубликованные" },
];

const isPublic = (status: EffectiveStatus) =>
  status === "published" || status === "published_scheduled";

function StatusBadge({ status, dateLabel }: { status: EffectiveStatus; dateLabel: string }) {
  switch (status) {
    case "draft":
      return <Badge variant="outline">Черновик</Badge>;
    case "scheduled":
      return (
        <div className="space-y-1">
          <Badge variant="secondary">Запланирована</Badge>
          <p className="text-muted-foreground text-xs whitespace-nowrap">на {dateLabel}</p>
        </div>
      );
    case "published_scheduled":
      return (
        <div className="space-y-1">
          <Badge>Опубликована</Badge>
          <p className="text-muted-foreground text-xs whitespace-nowrap">по расписанию</p>
        </div>
      );
    default:
      return <Badge>Опубликована</Badge>;
  }
}

function RowActions({ row }: { row: ArticleRow }) {
  return (
    // Меню и диалог — в порталах, но React-события всплывают к строке таблицы
    <div onClick={(event) => event.stopPropagation()}>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label="Действия">
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/admin/blog/articles/${row.id}`}>
              <Pencil className="h-4 w-4" aria-hidden />
              Редактировать
            </Link>
          </DropdownMenuItem>
          {isPublic(row.status) ? (
            <DropdownMenuItem asChild>
              <a href={`/blog/${row.slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" aria-hidden />
                Открыть на сайте
              </a>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <ConfirmDialog
            trigger={
              <DropdownMenuItem variant="destructive" onSelect={(event) => event.preventDefault()}>
                <Trash2 className="h-4 w-4" aria-hidden />
                Удалить
              </DropdownMenuItem>
            }
            title={`Удалить статью «${row.title}»?`}
            description="Статья исчезнет с сайта, её адрес будет отдавать 404. Действие нельзя отменить."
            onConfirm={async () => {
              const res = await deleteArticle({ id: row.id });
              if (res.ok) toast.success("Статья удалена");
              return res;
            }}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const columns: ColumnDef<ArticleRow, unknown>[] = [
  {
    accessorKey: "title",
    header: "Заголовок",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="min-w-56 space-y-1">
        <Link
          href={`/admin/blog/articles/${row.original.id}`}
          className="font-medium hover:underline"
        >
          {row.original.title}
        </Link>
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 font-mono text-xs">
          /blog/{row.original.slug}
          {row.original.isFeatured ? (
            <Star className="h-3 w-3 fill-current" aria-label="Рекомендуемая" />
          ) : null}
          {row.original.noindex ? <Badge variant="outline">noindex</Badge> : null}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "rubricName",
    header: "Рубрика",
    enableSorting: false,
    cell: ({ row }) => row.original.rubricName ?? <span className="text-muted-foreground">—</span>,
  },
  {
    accessorKey: "authorName",
    header: "Автор",
    enableSorting: false,
    cell: ({ row }) => row.original.authorName ?? <span className="text-muted-foreground">—</span>,
  },
  {
    accessorKey: "status",
    header: "Статус",
    enableSorting: false,
    cell: ({ row }) => (
      <StatusBadge status={row.original.status} dateLabel={row.original.dateLabel} />
    ),
  },
  {
    accessorKey: "dateLabel",
    header: "Дата",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="text-sm whitespace-nowrap">
        {row.original.dateLabel}
        {row.original.status === "draft" ? (
          <span className="text-muted-foreground block text-xs">изменена</span>
        ) : null}
      </span>
    ),
  },
  {
    id: "view",
    header: () => <span className="sr-only">На сайте</span>,
    enableSorting: false,
    cell: ({ row }) =>
      isPublic(row.original.status) ? (
        <Button asChild variant="ghost" size="icon" aria-label="Открыть на сайте">
          <a href={`/blog/${row.original.slug}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        </Button>
      ) : null,
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Действия</span>,
    enableSorting: false,
    cell: ({ row }) => <RowActions row={row.original} />,
  },
];

/** Таблица статей: фильтр статуса и поиск — в URL (`?status=`, `?q=`), пагинация на сервере. */
export function ArticlesTable({ rows, filter, q, page, pageCount, total }: ArticlesTableProps) {
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

  function pageHref(target: number): string {
    const params = new URLSearchParams(searchParams.toString());
    if (target <= 1) params.delete("page");
    else params.set("page", String(target));
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed === lastPushedQ.current) return;
    const timer = window.setTimeout(() => {
      lastPushedQ.current = trimmed;
      updateParams({ q: trimmed || null, page: null });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // updateParams пересоздаётся на каждый рендер; зависим только от текста поиска
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <Tabs
          value={filter}
          onValueChange={(value) =>
            updateParams({ status: value === "all" ? null : value, page: null })
          }
        >
          <TabsList>
            {FILTER_OPTIONS.map((option) => (
              <TabsTrigger key={option.value} value={option.value}>
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              type="search"
              value={search}
              placeholder="Поиск по заголовку"
              aria-label="Поиск по заголовку"
              className="pl-8"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {isPending ? (
            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" aria-label="Загрузка" />
          ) : null}
        </div>
      </div>

      <div className={isPending ? "opacity-60 transition-opacity" : "transition-opacity"}>
        <DataTable
          columns={columns}
          data={rows}
          pageSize={rows.length || 1}
          getRowHref={(row) => `/admin/blog/articles/${row.id}`}
          emptyText={
            q || filter !== "all" ? "Ничего не найдено" : "Статей пока нет. Создайте первую"
          }
        />
      </div>

      {pageCount > 1 ? (
        <nav className="flex items-center justify-between gap-2 text-sm" aria-label="Страницы">
          <span className="text-muted-foreground">
            Страница {page} из {pageCount} · всего {total}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(page - 1)} scroll={false}>
                  Назад
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Назад
              </Button>
            )}
            {page < pageCount ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(page + 1)} scroll={false}>
                  Вперёд
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Вперёд
              </Button>
            )}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
