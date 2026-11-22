"use client";

import { useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type HeaderContext,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type DataTableFilter = {
  columnId: string;
  label: string;
  options: { value: string; label: string }[];
};

export type DataTableProps<TData> = {
  /** Колонки определяются в client-файле потребителя (функции нельзя передать из Server Component) */
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  /** Если задан — глобальный поиск по строковым и числовым значениям */
  searchPlaceholder?: string;
  /** Select-фильтры по колонкам (точное совпадение значения; для массивов — вхождение) */
  filters?: DataTableFilter[];
  /** По умолчанию 20 */
  pageSize?: number;
  /** Клик по строке → `router.push` */
  getRowHref?: (row: TData) => string;
  /** По умолчанию «Ничего не найдено» */
  emptyText?: string;
  /** Справа от поиска (например, кнопка «Добавить») */
  toolbar?: ReactNode;
};

const DEFAULT_PAGE_SIZE = 20;
/** Radix Select не допускает пустое значение у пункта */
const ALL_VALUE = "__all__";
/** Клик по этим элементам внутри строки не должен открывать карточку */
const INTERACTIVE_SELECTOR =
  "a, button, input, select, textarea, label, [role='checkbox'], [role='menuitem'], [data-row-click='ignore']";

/** Точное совпадение для select-фильтров; массивы (например, категории) — по вхождению. */
const equalsFilter: FilterFn<unknown> = (row, columnId, filterValue: string) => {
  const value: unknown = row.getValue(columnId);
  if (Array.isArray(value)) return value.map(String).includes(filterValue);
  return String(value ?? "") === filterValue;
};

function SortIcon<TData>({ column }: { column: Column<TData, unknown> }) {
  const sorted = column.getIsSorted();
  if (sorted === "asc") return <ArrowUp className="h-4 w-4" aria-hidden />;
  if (sorted === "desc") return <ArrowDown className="h-4 w-4" aria-hidden />;
  return <ArrowUpDown className="h-4 w-4 opacity-50" aria-hidden />;
}

function SortButton<TData>({ column, label }: { column: Column<TData, unknown>; label: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ml-2 h-8 px-2"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      <SortIcon column={column} />
    </Button>
  );
}

/**
 * Заголовок колонки с сортировкой по клику:
 * `{ accessorKey: "title", header: sortableHeader("Название") }`.
 * Строковые заголовки сортируемых колонок DataTable оборачивает так же автоматически.
 */
export function sortableHeader(label: string) {
  function SortableHeader<TData>({ column }: HeaderContext<TData, unknown>) {
    return <SortButton column={column} label={label} />;
  }
  return SortableHeader;
}

export function DataTable<TData>({
  columns,
  data,
  searchPlaceholder,
  filters,
  pageSize = DEFAULT_PAGE_SIZE,
  getRowHref,
  emptyText = "Ничего не найдено",
  toolbar,
}: DataTableProps<TData>) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // TanStack Table несовместим с мемоизацией React Compiler — компонент просто не компилируется им
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable<TData>({
    data,
    columns,
    defaultColumn: { filterFn: equalsFilter as FilterFn<TData> },
    state: { sorting, globalFilter, columnFilters },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    globalFilterFn: "includesString",
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageIndex: 0, pageSize } },
  });

  const pageCount = Math.max(1, table.getPageCount());
  const hasToolbar = Boolean(searchPlaceholder || (filters && filters.length > 0) || toolbar);

  function openRow(row: TData, event: MouseEvent | KeyboardEvent) {
    if (!getRowHref) return;
    const target = event.target as HTMLElement;
    if (target !== event.currentTarget && target.closest(INTERACTIVE_SELECTOR)) return;
    const href = getRowHref(row);
    // Ctrl/Cmd+клик — в новой вкладке, как у обычной ссылки
    if ("metaKey" in event && (event.metaKey || event.ctrlKey)) {
      window.open(href, "_blank", "noopener");
      return;
    }
    router.push(href);
  }

  return (
    <div className="space-y-4">
      {hasToolbar ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {searchPlaceholder ? (
            <div className="relative w-full sm:max-w-xs">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2"
                aria-hidden
              />
              <Input
                type="search"
                value={globalFilter}
                onChange={(event) => setGlobalFilter(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="pl-8"
              />
            </div>
          ) : null}
          {filters?.map((filter) => {
            const column = table.getColumn(filter.columnId);
            if (!column) return null;
            const value = (column.getFilterValue() as string | undefined) ?? ALL_VALUE;
            return (
              <Select
                key={filter.columnId}
                value={value}
                onValueChange={(next) =>
                  column.setFilterValue(next === ALL_VALUE ? undefined : next)
                }
              >
                <SelectTrigger className="w-full sm:w-48" aria-label={filter.label}>
                  <SelectValue placeholder={filter.label} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>{filter.label}: все</SelectItem>
                  {filter.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          })}
          {toolbar ? <div className="flex items-center gap-2 sm:ml-auto">{toolbar}</div> : null}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const def = header.column.columnDef.header;
                  const autoSort = typeof def === "string" && header.column.getCanSort();
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={
                        header.column.getIsSorted() === "asc"
                          ? "ascending"
                          : header.column.getIsSorted() === "desc"
                            ? "descending"
                            : undefined
                      }
                    >
                      {header.isPlaceholder ? null : autoSort ? (
                        <SortButton column={header.column} label={def} />
                      ) : (
                        flexRender(def, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(getRowHref && "cursor-pointer")}
                  tabIndex={getRowHref ? 0 : undefined}
                  onClick={getRowHref ? (event) => openRow(row.original, event) : undefined}
                  onKeyDown={
                    getRowHref
                      ? (event) => {
                          if (event.key === "Enter") openRow(row.original, event);
                        }
                      : undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length || 1}
                  className="text-muted-foreground h-24 text-center"
                >
                  {emptyText}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            Страница {table.getState().pagination.pageIndex + 1} из {pageCount}
            <span className="hidden sm:inline">
              {" "}
              · всего {table.getFilteredRowModel().rows.length}
            </span>
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Назад
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Вперёд
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
