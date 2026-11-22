"use client";

import { useState } from "react";
import { ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatRub } from "../../menu/_lib/labels";
import type { VariantOption } from "../_queries";

/** Сколько совпадений показывать — список из ~300 вариантов не рендерим целиком */
const MAX_RESULTS = 50;

export function variantOptionText(option: VariantOption): string {
  const base = option.label ? `${option.itemName} — ${option.label}` : option.itemName;
  return `${base} · ${formatRub(option.price)}`;
}

export type VariantPickerProps = {
  options: VariantOption[];
  value: string | null;
  onChange: (variantId: string) => void;
  invalid?: boolean;
};

/** Поиск и выбор варианта позиции меню: Popover + фильтр по подстроке без учёта регистра. */
export function VariantPicker({ options, value, onChange, invalid = false }: VariantPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = value ? options.find((option) => option.id === value) : undefined;

  const needle = query.trim().toLocaleLowerCase("ru");
  const matches = (
    needle
      ? options.filter((option) =>
          variantOptionText(option).toLocaleLowerCase("ru").includes(needle)
        )
      : options
  ).slice(0, MAX_RESULTS);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          className={cn(
            "w-full justify-between font-normal",
            !selected && "text-muted-foreground",
            invalid && "border-destructive"
          )}
        >
          <span className="truncate">
            {selected
              ? variantOptionText(selected)
              : value
                ? "Позиция не найдена"
                : "Выберите позицию меню"}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(32rem,calc(100vw-2rem))] p-2"
        onOpenAutoFocus={(event) => {
          // Фокус сразу в поле поиска
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)?.querySelector("input")?.focus();
        }}
      >
        <div className="relative mb-2">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по названию"
            aria-label="Поиск позиции меню"
            className="pl-9"
          />
        </div>
        <ul role="listbox" aria-label="Позиции меню" className="max-h-72 overflow-y-auto">
          {matches.length === 0 ? (
            <li className="text-muted-foreground px-2 py-6 text-center text-sm">
              Ничего не найдено
            </li>
          ) : (
            matches.map((option) => (
              <li key={option.id} role="option" aria-selected={option.id === value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "hover:bg-accent focus-visible:bg-accent w-full rounded-sm px-2 py-1.5 text-left text-sm transition-colors focus-visible:outline-none",
                    option.id === value && "bg-accent font-medium",
                    option.inactive && "text-muted-foreground"
                  )}
                >
                  {variantOptionText(option)}
                  {option.inactive ? <span className="text-xs"> (скрыта)</span> : null}
                </button>
              </li>
            ))
          )}
        </ul>
        {!needle && options.length > MAX_RESULTS ? (
          <p className="text-muted-foreground px-2 pt-2 text-xs">
            Показаны первые {MAX_RESULTS} из {options.length} — уточните поиск
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
