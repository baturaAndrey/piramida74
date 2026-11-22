"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Подпись значения (по умолчанию — само число) */
  format?: (value: number) => string;
  /** Связь с `<Label htmlFor>`: id получает область значения */
  id?: string;
  /** Доступное имя группы, если нет видимого `Label` */
  label?: string;
  size?: "default" | "sm";
  className?: string;
}

/** Округление к шагу без накопления ошибок float (0.1 + 0.2) */
function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** −/значение/+ для гостей, столов, длительности и количеств. Тач-цели ≥ 40px. */
export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  format,
  id,
  label,
  size = "default",
  className,
}: StepperProps) {
  const change = (delta: number) => {
    const next = Math.min(max, Math.max(min, roundToStep(value + delta, step)));
    if (next !== value) onChange(next);
  };
  const btnClass = size === "sm" ? "size-10 sm:size-8" : "size-10";

  return (
    <div
      role="group"
      aria-label={label}
      className={cn("inline-flex items-center gap-1", className)}
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={btnClass}
        onClick={() => change(-step)}
        disabled={value <= min}
        aria-label="Уменьшить"
      >
        <Minus className="size-4" aria-hidden="true" />
      </Button>
      <output
        id={id}
        aria-live="polite"
        className={cn(
          "min-w-12 text-center font-semibold tabular-nums",
          size === "sm" ? "text-sm" : "text-base"
        )}
      >
        {format ? format(value) : value}
      </output>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={btnClass}
        onClick={() => change(step)}
        disabled={value >= max}
        aria-label="Увеличить"
      >
        <Plus className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
