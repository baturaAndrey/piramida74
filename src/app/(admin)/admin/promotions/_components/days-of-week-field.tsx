"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WEEK_DAY_SHORT, WEEK_DAYS_ORDER } from "../_lib/labels";

type DaysOfWeekFieldProps = {
  /** 0 = Вс … 6 = Сб; null/пусто — каждый день */
  value: number[] | null;
  onChange: (next: number[] | null) => void;
  disabled?: boolean;
};

/** Дни недели акции; пустой выбор — каждый день (нормализация в null — на сервере). */
export function DaysOfWeekField({ value, onChange, disabled = false }: DaysOfWeekFieldProps) {
  const selected = (value ?? []).map(String);

  return (
    <ToggleGroup
      type="multiple"
      variant="outline"
      spacing={1}
      className="flex-wrap"
      value={selected}
      disabled={disabled}
      aria-label="Дни недели"
      onValueChange={(next) => {
        const days = next.map(Number);
        onChange(days.length > 0 ? days : null);
      }}
    >
      {WEEK_DAYS_ORDER.map((day) => (
        <ToggleGroupItem
          key={day}
          value={String(day)}
          className="w-11"
          aria-label={WEEK_DAY_SHORT[day]}
        >
          {WEEK_DAY_SHORT[day]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
