"use client";

import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { CalcExtraService, CalcPriceUnit } from "@/lib/calculator/types";
import type { KeyQty } from "@/lib/calculator/url-state";
import { formatRub, MAX_LIST_QTY, setKeyQty, toQtyMap } from "./calculator-helpers";
import { Stepper } from "./stepper";

const UNIT_SUFFIX: Record<CalcPriceUnit, string> = {
  per_hour: "/час",
  fixed: "",
  per_session: "/сеанс",
};

interface ExtrasPickerProps {
  extraServices: CalcExtraService[];
  /** Текущее значение `x` (id:qty) */
  value: KeyQty[];
  onChange: (value: KeyQty[]) => void;
}

/** Доп. услуги: чекбокс + количество (0 = не выбрано) */
export function ExtrasPicker({ extraServices, value, onChange }: ExtrasPickerProps) {
  const uid = useId();
  if (extraServices.length === 0) return null;
  const qtyById = toQtyMap(value);

  return (
    <fieldset className="space-y-3">
      <legend className="mb-3 text-sm font-semibold">Дополнительные услуги</legend>
      <ul className="divide-border divide-y rounded-md border">
        {extraServices.map((service) => {
          const qty = qtyById[service.id] ?? 0;
          const checkboxId = `${uid}-${service.id}`;
          return (
            <li
              key={service.id}
              className="flex min-h-14 flex-wrap items-center justify-between gap-3 p-3"
            >
              <div className="flex items-center gap-3">
                <Checkbox
                  id={checkboxId}
                  className="size-5"
                  checked={qty > 0}
                  onCheckedChange={(checked) =>
                    onChange(setKeyQty(value, service.id, checked === true ? 1 : 0))
                  }
                />
                <Label htmlFor={checkboxId} className="flex-col items-start gap-0.5 font-normal">
                  <span className="font-medium">{service.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {formatRub(service.price)}
                    {UNIT_SUFFIX[service.priceUnit]}
                  </span>
                </Label>
              </div>
              {qty > 0 ? (
                <Stepper
                  size="sm"
                  label={`Количество: ${service.name}`}
                  value={qty}
                  min={0}
                  max={MAX_LIST_QTY}
                  onChange={(next) => onChange(setKeyQty(value, service.id, next))}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
