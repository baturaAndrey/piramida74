"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CalcSet } from "@/lib/calculator/types";
import type { KeyQty } from "@/lib/calculator/url-state";
import { cn } from "@/lib/utils";
import { formatRub, MAX_LIST_QTY, setKeyQty, toQtyMap } from "./calculator-helpers";
import { Stepper } from "./stepper";

interface SetsPickerProps {
  sets: CalcSet[];
  /** Текущее значение `s` (code:qty) */
  value: KeyQty[];
  onChange: (value: KeyQty[]) => void;
  guests: number;
}

function guestsLimit(set: CalcSet): string | null {
  const min = set.minGuests ?? null;
  const max = set.maxGuests ?? null;
  if (min != null && max != null) return `от ${min} до ${max} гостей`;
  if (min != null) return `от ${min} гостей`;
  if (max != null) return `до ${max} гостей`;
  return null;
}

/** Банкетные сеты: карточки с кнопкой «Добавить», затем количество */
export function SetsPicker({ sets, value, onChange, guests }: SetsPickerProps) {
  if (sets.length === 0) {
    return <p className="text-muted-foreground text-sm">Банкетные сеты пока не добавлены</p>;
  }
  const qtyByCode = toQtyMap(value);

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {sets.map((set) => {
        const qty = qtyByCode[set.code] ?? 0;
        const perPerson = set.pricingMode === "per_person";
        const limit = guestsLimit(set);
        // per_person: количество = число персон (начально — все гости), fixed: штуки
        const initialQty = perPerson ? Math.min(guests, MAX_LIST_QTY) : 1;
        return (
          <li
            key={set.code}
            className={cn(
              "flex flex-col justify-between gap-3 rounded-lg border p-4 transition-colors",
              qty > 0 && "border-primary bg-accent/40"
            )}
          >
            <div className="space-y-1">
              <p className="leading-snug font-semibold">{set.title}</p>
              <p className="text-sm">
                <span className="font-semibold">{formatRub(set.price)}</span>{" "}
                <span className="text-muted-foreground">
                  {perPerson ? "за человека" : "за сет"}
                </span>
              </p>
              {limit ? <p className="text-muted-foreground text-xs">{limit}</p> : null}
            </div>
            {qty > 0 ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-xs">
                  {perPerson ? "Персон" : "Количество"}
                </span>
                <Stepper
                  size="sm"
                  label={`${perPerson ? "Персон" : "Количество"}: ${set.title}`}
                  value={qty}
                  min={0}
                  max={MAX_LIST_QTY}
                  onChange={(next) => onChange(setKeyQty(value, set.code, next))}
                />
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-10 self-start"
                onClick={() => onChange(setKeyQty(value, set.code, initialQty))}
              >
                <Plus className="size-4" aria-hidden="true" />
                Добавить
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
