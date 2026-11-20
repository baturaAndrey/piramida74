"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Copy, Plus, Trash2 } from "lucide-react";
import {
  type ArrayPath,
  type Control,
  Controller,
  type FieldArray,
  type FieldValues,
  get,
  type Path,
  useFieldArray,
  useFormState,
} from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MeasureUnit } from "@/lib/schema/enums";
import { cn } from "@/lib/utils";
import { UNIT_LABELS, UNIT_VALUES } from "../_lib/labels";

/* ---------- Код только для чтения ---------- */

const COPIED_MS = 1500;

/** Код позиции/варианта/уровня/сета: серым моноширинным шрифтом, с кнопкой «Копировать» */
export function CopyCode({ code, className }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      toast.error("Не удалось скопировать");
    }
  }

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <code className="text-muted-foreground font-mono text-xs">{code}</code>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-6"
        onClick={() => void copy()}
        aria-label={`Копировать код ${code}`}
        title="Копировать"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-600" aria-hidden />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden />
        )}
      </Button>
    </span>
  );
}

/* ---------- Таблица вариантов / уровней сетки ---------- */

/** Строка цены: вариант позиции или уровень сетки */
export type PriceRowValue = {
  id?: string | undefined;
  code?: string | undefined;
  label: string | null;
  amount: number | null;
  unit: MeasureUnit | null;
  price: number;
};

export const EMPTY_PRICE_ROW: PriceRowValue = { label: null, amount: null, unit: null, price: 0 };

const NO_UNIT = "__none__";

export type VariantsTableProps<T extends FieldValues> = {
  control: Control<T>;
  /** Путь к массиву строк (`variants` у позиции, `tiers` у сетки цен) */
  name: ArrayPath<T>;
  /** Подсказка в пустой ячейке «Подпись» */
  labelPlaceholder?: string;
  /** Текст в колонке «Код» для ещё не сохранённых строк */
  newCodeText?: string;
  addLabel?: string;
  /** Нельзя удалить последнюю строку */
  minRows?: number;
};

/** Числовое поле: пустая строка → null */
function toNumberOrNull(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

/**
 * Inline-таблица строк цены: подпись, количество, единица, цена, код (только чтение),
 * порядок кнопками ↑/↓ (`useFieldArray.move`), удаление строки.
 */
export function VariantsTable<T extends FieldValues>({
  control,
  name,
  labelPlaceholder = "Например: 0,3 л",
  newCodeText = "новый",
  addLabel = "Вариант",
  minRows = 0,
}: VariantsTableProps<T>) {
  // keyName: у строк есть собственное поле id (uuid из БД) — ключ RHF не должен его перекрывать
  const { fields, append, remove, move } = useFieldArray({ control, name, keyName: "fieldKey" });
  const { errors } = useFormState({ control, name: name as unknown as Path<T> });
  // Пути строк строятся динамически: типы RHF не выводят их из ArrayPath, приводим явно
  const path = (index: number, key: keyof PriceRowValue) => `${name}.${index}.${key}` as Path<T>;
  const errorOf = (index: number, key: keyof PriceRowValue): string | undefined =>
    (get(errors, `${name}.${index}.${key}`) as { message?: string } | undefined)?.message;
  const rootError =
    (get(errors, name) as { message?: string; root?: { message?: string } } | undefined)?.message ??
    (get(errors, `${name}.root`) as { message?: string } | undefined)?.message;

  return (
    <div className="space-y-2">
      <div className="text-muted-foreground hidden grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_7rem_6.5rem_6.5rem] gap-2 px-1 text-xs font-medium sm:grid">
        <span>Подпись</span>
        <span>Кол-во</span>
        <span>Ед.</span>
        <span>Цена, ₽</span>
        <span>Код</span>
        <span className="sr-only">Действия</span>
      </div>

      <ul className="space-y-2">
        {fields.map((field, index) => {
          const saved = field as unknown as PriceRowValue;
          const rowErrors = [
            errorOf(index, "label"),
            errorOf(index, "amount"),
            errorOf(index, "unit"),
            errorOf(index, "price"),
          ].filter(Boolean);
          return (
            <li key={field.fieldKey} className="rounded-md border p-2 sm:border-0 sm:p-0">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_7rem_6.5rem_6.5rem] sm:items-center">
                <Controller
                  control={control}
                  name={path(index, "label")}
                  render={({ field: f }) => (
                    <Input
                      ref={f.ref}
                      name={f.name}
                      value={(f.value as string | null) ?? ""}
                      onChange={(event) => f.onChange(event.target.value)}
                      onBlur={f.onBlur}
                      maxLength={60}
                      placeholder={labelPlaceholder}
                      aria-label="Подпись"
                      aria-invalid={Boolean(errorOf(index, "label"))}
                      className="col-span-2 sm:col-span-1"
                    />
                  )}
                />
                <Controller
                  control={control}
                  name={path(index, "amount")}
                  render={({ field: f }) => (
                    <Input
                      ref={f.ref}
                      name={f.name}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      value={(f.value as number | null) ?? ""}
                      onChange={(event) => f.onChange(toNumberOrNull(event.target.value))}
                      onBlur={f.onBlur}
                      placeholder="—"
                      aria-label="Количество"
                      aria-invalid={Boolean(errorOf(index, "amount"))}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name={path(index, "unit")}
                  render={({ field: f }) => (
                    <Select
                      value={(f.value as MeasureUnit | null) ?? NO_UNIT}
                      onValueChange={(value) => f.onChange(value === NO_UNIT ? null : value)}
                    >
                      <SelectTrigger
                        ref={f.ref}
                        onBlur={f.onBlur}
                        className="w-full"
                        aria-label="Единица"
                        aria-invalid={Boolean(errorOf(index, "unit"))}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_UNIT}>—</SelectItem>
                        {UNIT_VALUES.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {UNIT_LABELS[unit]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <Controller
                  control={control}
                  name={path(index, "price")}
                  render={({ field: f }) => (
                    <Input
                      ref={f.ref}
                      name={f.name}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      value={Number.isFinite(f.value as number) ? (f.value as number) : ""}
                      onChange={(event) =>
                        f.onChange(
                          event.target.value === "" ? Number.NaN : Number(event.target.value)
                        )
                      }
                      onBlur={f.onBlur}
                      aria-label="Цена, ₽"
                      aria-invalid={Boolean(errorOf(index, "price"))}
                      className="tabular-nums"
                    />
                  )}
                />
                <div className="flex min-h-9 items-center">
                  {saved.id && saved.code ? (
                    <CopyCode code={saved.code} />
                  ) : (
                    <span className="text-muted-foreground font-mono text-xs">{newCodeText}</span>
                  )}
                </div>
                <div className="flex items-center justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => move(index, index - 1)}
                    disabled={index === 0}
                    aria-label="Выше"
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => move(index, index + 1)}
                    disabled={index === fields.length - 1}
                    aria-label="Ниже"
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive size-8"
                    onClick={() => remove(index)}
                    disabled={fields.length <= minRows}
                    aria-label="Удалить строку"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </div>
              {rowErrors.length > 0 ? (
                <p className="text-destructive mt-1 text-sm">{rowErrors.join(". ")}</p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {rootError ? <p className="text-destructive text-sm">{rootError}</p> : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append({ ...EMPTY_PRICE_ROW } as FieldArray<T, ArrayPath<T>>)}
      >
        <Plus className="h-4 w-4" aria-hidden />
        {addLabel}
      </Button>
    </div>
  );
}
