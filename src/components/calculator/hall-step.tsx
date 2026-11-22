"use client";

import { useId } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CalcHall, CalculatorCatalog } from "@/lib/calculator/types";
import type { CalculatorUrlState } from "@/lib/calculator/url-state";
import { autoTables, type CalculatorPatch } from "./calculator-helpers";
import { ExtrasPicker } from "./extras-picker";
import { Stepper } from "./stepper";

interface HallStepProps {
  state: CalculatorUrlState;
  onChange: (patch: CalculatorPatch) => void;
  catalog: CalculatorCatalog;
  /** Зал, который фактически используется в расчёте (из `toQuoteInput`) */
  hall: CalcHall | undefined;
}

function hasPensionerTariff(catalog: CalculatorCatalog, hallId: string): boolean {
  return catalog.tariffs.some((t) => t.hallId === hallId && t.audience === "pensioner");
}

/** Шаг 2: зал, столы, пенсионный тариф, доп. услуги */
export function HallStep({ state, onChange, catalog, hall }: HallStepProps) {
  const uid = useId();
  const ids = { hall: `${uid}-hall`, tables: `${uid}-tables`, pensioner: `${uid}-pensioner` };

  const selectHall = (slug: string) => {
    const next = catalog.halls.find((h) => h.slug === slug);
    if (!next) return;
    onChange({
      // Первый зал каталога — значение по умолчанию, его в URL не пишем
      hall: next.id === catalog.halls[0]?.id ? null : next.slug,
      // Ручное число столов относится к прежнему залу
      tables: null,
      // Пенсионный флаг без пенсионного тарифа не имеет смысла
      ...(hasPensionerTariff(catalog, next.id) ? {} : { p: null }),
    });
  };

  const showPensioner = hall ? hasPensionerTariff(catalog, hall.id) : false;
  const tablesAuto = state.tables == null;
  const tables = hall ? Math.min(hall.tablesCount, state.tables ?? autoTables(hall, state.g)) : 1;
  const atMax = hall ? tables >= hall.tablesCount : false;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={ids.hall}>Зал</Label>
          {catalog.halls.length > 0 ? (
            <Select value={hall?.slug ?? ""} onValueChange={selectHall}>
              <SelectTrigger id={ids.hall} className="w-full data-[size=default]:h-10">
                <SelectValue placeholder="Выберите зал" />
              </SelectTrigger>
              <SelectContent>
                {catalog.halls.map((h) => (
                  <SelectItem key={h.id} value={h.slug}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-muted-foreground text-sm">Залы пока не настроены</p>
          )}
        </div>

        {hall?.kind === "common" ? (
          <div className="space-y-2">
            <Label htmlFor={ids.tables}>Столов</Label>
            <div className="flex flex-wrap items-center gap-3">
              <Stepper
                id={ids.tables}
                value={tables}
                min={1}
                max={Math.max(1, hall.tablesCount)}
                onChange={(next) => onChange({ tables: next })}
              />
              {tablesAuto ? (
                <span className="text-muted-foreground text-xs">авто по числу гостей</span>
              ) : (
                <Button
                  type="button"
                  variant="link"
                  className="h-10 px-0"
                  onClick={() => onChange({ tables: null })}
                >
                  Сбросить на авто
                </Button>
              )}
            </div>
            {atMax ? (
              <p className="text-muted-foreground text-xs">
                Максимум столов в зале: {hall.tablesCount}
              </p>
            ) : null}
          </div>
        ) : null}

        {hall?.kind === "vip" ? (
          <div className="text-muted-foreground flex items-start gap-2 self-end text-sm sm:pb-2.5">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>Цена за комнату целиком, стол в комнате один</span>
          </div>
        ) : null}
      </div>

      {showPensioner ? (
        <div className="flex items-start gap-3">
          <Checkbox
            id={ids.pensioner}
            className="mt-0.5 size-5"
            checked={state.p}
            onCheckedChange={(checked) => onChange({ p: checked === true ? true : null })}
          />
          <Label htmlFor={ids.pensioner} className="flex-col items-start gap-0.5 font-normal">
            <span className="font-medium">Пенсионер</span>
            <span className="text-muted-foreground text-xs">
              Пенсионный тариф действует только в указанные часы
            </span>
          </Label>
        </div>
      ) : null}

      <ExtrasPicker
        extraServices={catalog.extraServices}
        value={state.x}
        onChange={(x) => onChange({ x: x.length ? x : null })}
      />
    </div>
  );
}
