"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton } from "@/components/site/primary-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { serializeCalculator } from "@/lib/calculator/url-state";
import { cn } from "@/lib/utils";
import { formatHours, MAX_GUESTS, MIN_GUESTS } from "./calculator-helpers";
import { Stepper } from "./stepper";

const HOUR_OPTIONS = [1, 1.5, 2, 2.5, 3, 4, 5, 6] as const;
const DEFAULT_GUESTS = 8;
const DEFAULT_HOURS = 3;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface HomeCalculatorTeaserProps {
  /** Операционная дата «сегодня» с сервера — минимум и значение по умолчанию */
  opDate: string;
  className?: string;
}

/**
 * Мини-калькулятор для главной: гости, дата, часы → /calculator с этими параметрами.
 * Работает вне NuqsAdapter и без БД; query строит `serializeCalculator`, чтобы формат
 * совпадал с парсерами калькулятора.
 */
export function HomeCalculatorTeaser({ opDate, className }: HomeCalculatorTeaserProps) {
  const router = useRouter();
  const uid = useId();
  const [guests, setGuests] = useState(DEFAULT_GUESTS);
  const [date, setDate] = useState(opDate);
  const [hours, setHours] = useState<number>(DEFAULT_HOURS);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Пустая/прошедшая дата из нативного поля → «сегодня»
    const visitDate = ISO_DATE_RE.test(date) && date >= opDate ? date : opDate;
    router.push(
      `/calculator${serializeCalculator({
        guests,
        opDate: visitDate,
        durationMin: Math.round(hours * 60),
      })}`
    );
  };

  return (
    <form
      onSubmit={submit}
      className={cn("bg-card text-card-foreground rounded-lg border p-6 shadow-sm", className)}
      aria-labelledby={`${uid}-title`}
    >
      <h3 id={`${uid}-title`} className="text-xl font-semibold">
        Рассчитайте стоимость вечера
      </h3>
      <p className="text-muted-foreground mt-1 text-sm">
        Аренда стола, меню и банкетные сеты — итог сразу
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`${uid}-guests`}>Гости</Label>
          <div>
            <Stepper
              id={`${uid}-guests`}
              value={guests}
              min={MIN_GUESTS}
              max={MAX_GUESTS}
              onChange={setGuests}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${uid}-date`}>Дата</Label>
          <Input
            id={`${uid}-date`}
            type="date"
            min={opDate}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${uid}-hours`}>Часы</Label>
          <Select value={String(hours)} onValueChange={(v) => setHours(Number(v))}>
            <SelectTrigger id={`${uid}-hours`} className="w-full data-[size=default]:h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOUR_OPTIONS.map((h) => (
                <SelectItem key={h} value={String(h)}>
                  {formatHours(h)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <PrimaryButton type="submit" size="sm" className="mt-6 w-full sm:w-auto">
        Рассчитать
      </PrimaryButton>
    </form>
  );
}
