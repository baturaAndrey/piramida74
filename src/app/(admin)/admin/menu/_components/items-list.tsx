"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { runActionCallback, type ActionOutcome } from "@/components/admin/action-outcome";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { SortableList } from "@/components/admin/sortable-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { deleteMenuItem, quickSetPrice, reorderMenuItems, toggleMenuItem } from "../_actions";
import { formatRub, plural } from "../_lib/labels";
import type { AdminMenuItemRow, CategoryOption } from "../_queries";

/* ---------- Переключатель активности (общий для разделов меню и сетов) ---------- */

export type ActiveToggleProps = {
  checked: boolean;
  /** Server Action; `{ ok: false }` или исключение откатывают переключатель */
  onToggle: (next: boolean) => Promise<ActionOutcome>;
  label: string;
};

/** Оптимистичный Switch активности: сразу меняет состояние, откатывает при ошибке. */
export function ActiveToggle({ checked, onToggle, label }: ActiveToggleProps) {
  const router = useRouter();
  const [value, setValue] = useState(checked);
  const [syncedProp, setSyncedProp] = useState(checked);
  const [pending, setPending] = useState(false);

  // Новое значение из пропсов (после refresh) принимаем во время рендера
  if (checked !== syncedProp) {
    setSyncedProp(checked);
    setValue(checked);
  }

  async function handleChange(next: boolean) {
    setValue(next);
    setPending(true);
    const error = await runActionCallback(onToggle, [next], "Не удалось сохранить");
    setPending(false);
    if (error) {
      setValue(!next);
      toast.error(error);
      return;
    }
    router.refresh();
  }

  return (
    <Switch
      checked={value}
      disabled={pending}
      onCheckedChange={(next) => void handleChange(next)}
      aria-label={label}
      title={value ? "Показывается на сайте" : "Скрыто"}
    />
  );
}

/* ---------- Быстрое редактирование цены ---------- */

const SAVED_INDICATOR_MS = 1500;

function QuickPrice({ variantId, price }: { variantId: string; price: number }) {
  const router = useRouter();
  const [value, setValue] = useState(String(price));
  const [syncedPrice, setSyncedPrice] = useState(price);
  /** Последняя сохранённая цена: Enter и последующий blur не должны сохранять дважды */
  const [committed, setCommitted] = useState(price);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (price !== syncedPrice) {
    setSyncedPrice(price);
    setCommitted(price);
    setValue(String(price));
  }

  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    []
  );

  async function save() {
    const trimmed = value.trim();
    const next = Number(trimmed);
    if (trimmed === "" || !Number.isInteger(next) || next < 0) {
      toast.error("Цена — целое число рублей не меньше 0");
      setValue(String(committed));
      return;
    }
    if (next === committed || saving) return;
    setSaving(true);
    const result = await quickSetPrice({ variantId, price: next });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      setValue(String(committed));
      return;
    }
    setCommitted(next);
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), SAVED_INDICATOR_MS);
    router.refresh();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void save();
    } else if (event.key === "Escape") {
      setValue(String(committed));
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative">
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => void save()}
          onKeyDown={handleKeyDown}
          disabled={saving}
          aria-label="Цена, ₽"
          className="h-8 w-24 pr-6 text-right tabular-nums"
        />
        <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs">
          ₽
        </span>
      </div>
      <span className="flex size-4 items-center justify-center" aria-live="polite">
        {saving ? (
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" aria-label="Сохранение" />
        ) : saved ? (
          <Check className="h-4 w-4 text-green-600" aria-label="Сохранено" />
        ) : null}
      </span>
    </div>
  );
}

/* ---------- Список позиций ---------- */

export type ItemsListProps = {
  category: { id: string; title: string; priceGroupName: string | null };
  items: AdminMenuItemRow[];
  categoryOptions: CategoryOption[];
};

function PriceSummary({
  item,
  categoryGroupName,
}: {
  item: AdminMenuItemRow;
  categoryGroupName: string | null;
}) {
  const [single] = item.variants;
  if (item.variants.length === 1 && single) {
    return <QuickPrice variantId={single.id} price={single.price} />;
  }
  if (item.variants.length > 1) {
    const min = Math.min(...item.variants.map((variant) => variant.price));
    const n = item.variants.length;
    return (
      <span className="text-muted-foreground text-sm whitespace-nowrap">
        от {formatRub(min)} · {n} {plural(n, ["вариант", "варианта", "вариантов"])}
      </span>
    );
  }
  if (item.priceGroupName) return <Badge variant="secondary">Сетка: {item.priceGroupName}</Badge>;
  if (categoryGroupName) {
    return <Badge variant="outline">Сетка категории: {categoryGroupName}</Badge>;
  }
  return <Badge variant="destructive">Нет цен</Badge>;
}

export function ItemsList({ category, items, categoryOptions }: ItemsListProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase("ru");
  const visible = needle
    ? items.filter((item) => item.name.toLocaleLowerCase("ru").includes(needle))
    : items;
  const newHref = `/admin/menu/items/new?cat=${category.id}`;

  async function handleDelete(id: string): Promise<ActionOutcome> {
    const result = await deleteMenuItem({ id });
    if (result.ok) {
      toast.success("Позиция удалена");
      router.refresh();
    }
    return result;
  }

  return (
    <div className="space-y-4">
      {/* На мобильных дерево ниже списка — выбор категории через Select */}
      <div className="md:hidden">
        <Select value={category.id} onValueChange={(id) => router.push(`/admin/menu?cat=${id}`)}>
          <SelectTrigger className="w-full" aria-label="Категория">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categoryOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                <span className={cn(option.depth === 1 && "pl-4")}>{option.title}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold break-words">{category.title}</h2>
          <p className="text-muted-foreground text-sm">
            {items.length} {plural(items.length, ["позиция", "позиции", "позиций"])}
            {category.priceGroupName ? ` · сетка цен: ${category.priceGroupName}` : ""}
          </p>
        </div>
        <Button asChild size="sm" className="shrink-0">
          <Link href={newHref}>
            <Plus className="h-4 w-4" aria-hidden />
            Добавить позицию
          </Link>
        </Button>
      </div>

      {items.length > 0 ? (
        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по названию"
            aria-label="Поиск по названию"
            className="pl-9"
          />
        </div>
      ) : null}

      {needle ? (
        <p className="text-muted-foreground text-xs">
          Перетаскивание отключено, пока активен поиск
        </p>
      ) : null}

      {items.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          В категории пока нет позиций
        </div>
      ) : visible.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">Ничего не найдено</p>
      ) : (
        <SortableList
          items={visible}
          disabled={Boolean(needle)}
          onReorder={(ids) => reorderMenuItems({ categoryId: category.id, ids })}
          renderItem={(item, ctx) => (
            <div
              className={cn(
                "bg-card flex flex-col gap-3 rounded-lg border p-3 shadow-xs sm:flex-row sm:items-center",
                !item.isActive && "bg-muted/50"
              )}
            >
              <div className="flex min-w-0 flex-1 items-start gap-1">
                {ctx.dragHandle}
                <div className="min-w-0 flex-1 pt-1">
                  <Link
                    href={`/admin/menu/items/${item.id}`}
                    className={cn(
                      "font-medium break-words hover:underline",
                      !item.isActive && "text-muted-foreground"
                    )}
                  >
                    {item.name}
                  </Link>
                  {item.description ? (
                    <p className="text-muted-foreground line-clamp-2 text-sm">{item.description}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-9 sm:pl-0">
                <PriceSummary item={item} categoryGroupName={category.priceGroupName} />
                <ActiveToggle
                  checked={item.isActive}
                  onToggle={(isActive) => toggleMenuItem({ id: item.id, isActive })}
                  label={`Показывать «${item.name}»`}
                />
                <div className="flex items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={ctx.moveUp}
                    disabled={!ctx.canMoveUp}
                    aria-label="Выше"
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={ctx.moveDown}
                    disabled={!ctx.canMoveDown}
                    aria-label="Ниже"
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button asChild variant="ghost" size="icon" className="size-8">
                    <Link href={`/admin/menu/items/${item.id}`} aria-label="Изменить">
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Link>
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive size-8"
                        aria-label="Удалить"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    }
                    title={`Удалить «${item.name}»?`}
                    description="Позиция и её варианты будут удалены. Действие нельзя отменить."
                    onConfirm={() => handleDelete(item.id)}
                  />
                </div>
              </div>
            </div>
          )}
        />
      )}
    </div>
  );
}
