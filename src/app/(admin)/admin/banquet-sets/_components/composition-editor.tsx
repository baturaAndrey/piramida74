"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  type Control,
  Controller,
  get,
  useFieldArray,
  useFormState,
  useWatch,
} from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatRub } from "../../menu/_lib/labels";
import { MAX_QTY, type SetInput, type SetItemInput } from "../_schema";
import { VariantPicker } from "./variant-picker";
import type { VariantOption } from "../_queries";

const NEW_MENU_ROW: SetItemInput = {
  kind: "menu",
  // Пустой id: zod покажет «Выберите позицию меню», пока вариант не выбран
  menuItemVariantId: "",
  customLabel: null,
  qty: 1,
};

export type CompositionEditorProps = {
  control: Control<SetInput>;
  options: VariantOption[];
};

/** Состав сета: строки «позиция меню × кол-во» или «свой текст × кол-во», порядок ↑/↓. */
export function CompositionEditor({ control, options }: CompositionEditorProps) {
  const { fields, append, remove, move, update } = useFieldArray({
    control,
    name: "items",
    keyName: "fieldKey",
  });
  const { errors } = useFormState({ control, name: "items" });
  const items = useWatch({ control, name: "items" });
  const priceById = new Map(options.map((option) => [option.id, option.price]));

  // Информативная сумма по позициям из меню — только подсказка для сравнения с ценой сета
  const menuTotal = (items ?? []).reduce((sum, item) => {
    if (item.kind !== "menu" || !item.menuItemVariantId) return sum;
    const price = priceById.get(item.menuItemVariantId);
    const qty = Number.isFinite(item.qty) ? item.qty : 0;
    return price === undefined ? sum : sum + price * qty;
  }, 0);

  const errorOf = (index: number, key: string): string | undefined =>
    (get(errors, `items.${index}.${key}`) as { message?: string } | undefined)?.message;

  return (
    <div className="space-y-3">
      {fields.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed p-4 text-center text-sm">
          Состав пуст
        </p>
      ) : (
        <ul className="space-y-2">
          {fields.map((field, index) => {
            const row = items?.[index] ?? field;
            const rowError =
              errorOf(index, "menuItemVariantId") ??
              errorOf(index, "customLabel") ??
              errorOf(index, "qty");
            return (
              <li key={field.fieldKey} className="space-y-2 rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    value={row.kind}
                    onValueChange={(kind) => {
                      if (!kind || kind === row.kind) return;
                      update(
                        index,
                        kind === "menu"
                          ? { ...NEW_MENU_ROW, qty: row.qty }
                          : {
                              kind: "custom",
                              menuItemVariantId: null,
                              customLabel: "",
                              qty: row.qty,
                            }
                      );
                    }}
                    aria-label="Тип строки"
                  >
                    <ToggleGroupItem value="menu" className="px-3">
                      Из меню
                    </ToggleGroupItem>
                    <ToggleGroupItem value="custom" className="px-3">
                      Свой текст
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <div className="flex items-center">
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
                      aria-label="Удалить строку"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    {row.kind === "menu" ? (
                      <Controller
                        control={control}
                        name={`items.${index}.menuItemVariantId`}
                        render={({ field: f }) => (
                          <VariantPicker
                            options={options}
                            value={f.value || null}
                            onChange={f.onChange}
                            invalid={Boolean(errorOf(index, "menuItemVariantId"))}
                          />
                        )}
                      />
                    ) : (
                      <Controller
                        control={control}
                        name={`items.${index}.customLabel`}
                        render={({ field: f }) => (
                          <Input
                            ref={f.ref}
                            name={f.name}
                            value={f.value ?? ""}
                            onChange={(event) => f.onChange(event.target.value)}
                            onBlur={f.onBlur}
                            maxLength={160}
                            placeholder="Например: Соус на выбор"
                            aria-label="Текст строки"
                            aria-invalid={Boolean(errorOf(index, "customLabel"))}
                          />
                        )}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm" aria-hidden>
                      ×
                    </span>
                    <Controller
                      control={control}
                      name={`items.${index}.qty`}
                      render={({ field: f }) => (
                        <Input
                          ref={f.ref}
                          name={f.name}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={MAX_QTY}
                          step={1}
                          value={Number.isFinite(f.value) ? f.value : ""}
                          onChange={(event) =>
                            f.onChange(
                              event.target.value === "" ? Number.NaN : Number(event.target.value)
                            )
                          }
                          onBlur={f.onBlur}
                          aria-label="Количество"
                          aria-invalid={Boolean(errorOf(index, "qty"))}
                          className="w-20 tabular-nums"
                        />
                      )}
                    />
                  </div>
                </div>
                {rowError ? <p className="text-destructive text-sm">{rowError}</p> : null}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ ...NEW_MENU_ROW })}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Позиция из меню
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            append({ kind: "custom", menuItemVariantId: null, customLabel: "", qty: 1 })
          }
        >
          <Plus className="h-4 w-4" aria-hidden />
          Свой текст
        </Button>
      </div>

      <p className="text-muted-foreground text-sm">
        Стоимость состава по меню:{" "}
        <span className="text-foreground font-medium tabular-nums">{formatRub(menuTotal)}</span>
        <span className="text-xs"> — подсказка для сравнения с ценой сета</span>
      </p>
    </div>
  );
}
