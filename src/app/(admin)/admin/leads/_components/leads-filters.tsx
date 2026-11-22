"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildLeadsQuery,
  LEAD_STATUS_FILTER_LABELS,
  LEAD_STATUSES,
  LEAD_TYPE_LABELS,
  LEAD_TYPES,
  type LeadsFilterValues,
} from "../_lib/labels";

const LEADS_PATH = "/admin/leads";
const EXPORT_PATH = "/api/admin/leads/export";
/** Radix Select не допускает пустое значение у пункта */
const ALL_VALUE = "all";
const SEARCH_DEBOUNCE_MS = 400;

type LeadsFiltersProps = { values: LeadsFilterValues };

/** Фильтры списка заявок: состояние живёт в URL, любое изменение сбрасывает страницу. */
export function LeadsFilters({ values }: LeadsFiltersProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(values.q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  function navigate(next: Partial<LeadsFilterValues>) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const qs = buildLeadsQuery({ ...values, q: query, ...next });
    startTransition(() => {
      router.replace(qs ? `${LEADS_PATH}?${qs}` : LEADS_PATH, { scroll: false });
    });
  }

  function handleQueryChange(next: string) {
    setQuery(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate({ q: next }), SEARCH_DEBOUNCE_MS);
  }

  function reset() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQuery("");
    startTransition(() => router.replace(LEADS_PATH, { scroll: false }));
  }

  const exportQuery = buildLeadsQuery(values);
  const hasFilters = Object.values(values).some((value) => value !== "") || query !== "";

  return (
    <div className="space-y-4" aria-busy={isPending}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))]">
        <div className="space-y-2">
          <Label htmlFor="leads-q">Поиск</Label>
          <div className="relative">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id="leads-q"
              type="search"
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") navigate({ q: query });
              }}
              placeholder="Имя, телефон или номер"
              maxLength={100}
              className="pl-8"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="leads-status">Статус</Label>
          <Select
            value={values.status || ALL_VALUE}
            onValueChange={(next) => navigate({ status: next === ALL_VALUE ? "" : next })}
          >
            <SelectTrigger id="leads-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Все</SelectItem>
              {LEAD_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {LEAD_STATUS_FILTER_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="leads-type">Тип</Label>
          <Select
            value={values.type || ALL_VALUE}
            onValueChange={(next) => navigate({ type: next === ALL_VALUE ? "" : next })}
          >
            <SelectTrigger id="leads-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Все</SelectItem>
              {LEAD_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {LEAD_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="leads-from">С даты</Label>
          <Input
            id="leads-from"
            type="date"
            value={values.from}
            max={values.to || undefined}
            onChange={(event) => navigate({ from: event.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="leads-to">По дату</Label>
          <Input
            id="leads-to"
            type="date"
            value={values.to}
            min={values.from || undefined}
            onChange={(event) => navigate({ to: event.target.value })}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={reset} disabled={!hasFilters}>
          <RotateCcw className="h-4 w-4" aria-hidden />
          Сбросить
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href={exportQuery ? `${EXPORT_PATH}?${exportQuery}` : EXPORT_PATH} download>
            <Download className="h-4 w-4" aria-hidden />
            Экспорт CSV
          </a>
        </Button>
        {isPending ? (
          <span
            className="text-muted-foreground inline-flex items-center gap-1.5 text-sm"
            role="status"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Обновление…
          </span>
        ) : null}
      </div>
    </div>
  );
}
