"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CalcMenuVariant } from "@/lib/calculator/types";
import { cn } from "@/lib/utils";
import {
  filterMenuGroups,
  formatRub,
  groupMenuVariants,
  MAX_LIST_QTY,
  type MenuPickerGroup,
  type MenuPickerItem,
} from "./calculator-helpers";
import { Stepper } from "./stepper";

/** Сколько позиций категории рендерить сразу; остальные — по «Показать ещё» */
const PAGE_SIZE = 30;
const ALL = "__all__";

interface MenuPickerProps {
  menuVariants: CalcMenuVariant[];
  /** Выбранные количества: code → qty */
  items: Record<string, number>;
  onChange: (code: string, qty: number) => void;
}

/**
 * Выбор позиций меню: поиск, чипы категорий, раскрывающиеся категории.
 * Свёрнутые категории не рендерят содержимое, раскрытые — порциями по 30 позиций,
 * чтобы не выводить сразу сотни интерактивных карточек.
 */
export function MenuPicker({ menuVariants, items, onChange }: MenuPickerProps) {
  const uid = useId();
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string>(ALL);
  const [openCats, setOpenCats] = useState<ReadonlySet<string>>(() => new Set());

  const groups = useMemo(() => groupMenuVariants(menuVariants), [menuVariants]);
  const searching = query.trim().length > 0;
  const visibleGroups = useMemo(() => {
    const found = filterMenuGroups(groups, query);
    return activeCat === ALL ? found : found.filter((g) => g.categorySlug === activeCat);
  }, [groups, query, activeCat]);

  // Поиск или выбранный чип раскрывают категории принудительно
  const forcedOpen = searching || activeCat !== ALL;

  const toggleCat = (slug: string) =>
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  if (groups.length === 0) {
    return <p className="text-muted-foreground text-sm">Меню пока не заполнено</p>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${uid}-search`} className="sr-only">
          Поиск по меню
        </Label>
        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            id={`${uid}-search`}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по меню"
            className="h-10 pl-9"
            autoComplete="off"
          />
        </div>
      </div>

      <div
        role="group"
        aria-label="Категории меню"
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2"
      >
        <CategoryChip pressed={activeCat === ALL} onClick={() => setActiveCat(ALL)}>
          Все
        </CategoryChip>
        {groups.map((g) => (
          <CategoryChip
            key={g.categorySlug}
            pressed={activeCat === g.categorySlug}
            onClick={() => setActiveCat(g.categorySlug)}
          >
            {g.categoryName}
          </CategoryChip>
        ))}
      </div>

      {visibleGroups.length === 0 ? (
        <p className="text-muted-foreground py-4 text-sm">Ничего не найдено</p>
      ) : (
        <ul className="divide-border divide-y rounded-md border">
          {visibleGroups.map((group) => (
            <CategorySection
              key={group.categorySlug}
              group={group}
              items={items}
              onChange={onChange}
              forcedOpen={forcedOpen}
              open={forcedOpen || openCats.has(group.categorySlug)}
              onToggle={() => toggleCat(group.categorySlug)}
              panelId={`${uid}-cat-${group.categorySlug}`}
            />
          ))}
        </ul>
      )}

      <Link
        href="/menu"
        className="text-primary inline-flex min-h-10 items-center text-sm underline-offset-4 hover:underline"
      >
        Всё меню
      </Link>
    </div>
  );
}

function CategoryChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={pressed ? "default" : "outline"}
      aria-pressed={pressed}
      onClick={onClick}
      className="h-10 shrink-0 rounded-full px-4"
    >
      {children}
    </Button>
  );
}

interface CategorySectionProps {
  group: MenuPickerGroup;
  items: Record<string, number>;
  onChange: (code: string, qty: number) => void;
  forcedOpen: boolean;
  open: boolean;
  onToggle: () => void;
  panelId: string;
}

function CategorySection({
  group,
  items,
  onChange,
  forcedOpen,
  open,
  onToggle,
  panelId,
}: CategorySectionProps) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const selectedCount = group.items.reduce(
    (sum, it) => sum + it.variants.reduce((s, v) => s + (items[v.code] ?? 0), 0),
    0
  );
  const shown = group.items.slice(0, limit);
  const rest = group.items.length - shown.length;

  const heading = (
    <span className="flex flex-1 items-center gap-2 text-left">
      <span className="font-semibold">{group.categoryName}</span>
      <span className="text-muted-foreground text-xs">{group.items.length}</span>
      {selectedCount > 0 ? (
        <Badge className="ml-auto">
          <span className="sr-only">Выбрано: </span>
          {selectedCount}
        </Badge>
      ) : null}
    </span>
  );

  return (
    <li>
      {forcedOpen ? (
        <h3 className="flex min-h-12 items-center px-4 py-2">{heading}</h3>
      ) : (
        <h3>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={onToggle}
            className="hover:bg-accent focus-visible:ring-ring/50 flex min-h-12 w-full items-center gap-3 px-4 py-2 transition-colors outline-none focus-visible:ring-[3px]"
          >
            {heading}
            <ChevronDown
              className={cn(
                "text-muted-foreground size-4 shrink-0 transition-transform",
                open && "rotate-180"
              )}
              aria-hidden="true"
            />
          </button>
        </h3>
      )}
      {open ? (
        <div id={panelId} className="space-y-4 px-4 pt-1 pb-4">
          <ul className="space-y-4">
            {shown.map((item) => (
              <MenuItemRow key={item.name} item={item} items={items} onChange={onChange} />
            ))}
          </ul>
          {rest > 0 ? (
            <Button
              type="button"
              variant="ghost"
              className="h-10"
              onClick={() => setLimit((n) => n + PAGE_SIZE)}
            >
              Показать ещё ({rest})
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function variantText(label: string, price: number): string {
  return label ? `${label} — ${formatRub(price)}` : formatRub(price);
}

function MenuItemRow({
  item,
  items,
  onChange,
}: {
  item: MenuPickerItem;
  items: Record<string, number>;
  onChange: (code: string, qty: number) => void;
}) {
  return (
    <li className="space-y-2">
      <p className="text-sm leading-snug font-medium">{item.name}</p>
      <div className="flex flex-wrap gap-2">
        {item.variants.map((v) => {
          const qty = items[v.code] ?? 0;
          const text = variantText(v.label, v.price);
          if (qty === 0) {
            return (
              <Button
                key={v.code}
                type="button"
                variant="outline"
                size="sm"
                className="h-10 font-normal"
                aria-label={`Добавить: ${item.name}${v.label ? `, ${v.label}` : ""}, ${formatRub(v.price)}`}
                onClick={() => onChange(v.code, 1)}
              >
                {text}
              </Button>
            );
          }
          return (
            <div
              key={v.code}
              className="border-primary bg-accent/40 flex items-center gap-2 rounded-md border py-0.5 pr-0.5 pl-3"
            >
              <span className="text-sm">{text}</span>
              <Stepper
                size="sm"
                label={`Количество: ${item.name}${v.label ? `, ${v.label}` : ""}`}
                value={qty}
                min={0}
                max={MAX_LIST_QTY}
                onChange={(next) => onChange(v.code, next)}
              />
            </div>
          );
        })}
      </div>
    </li>
  );
}
